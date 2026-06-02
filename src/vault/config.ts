// Vault connection config — origin + bearer token, stored in localStorage.
// NO hardcoded origin or token anywhere. The user signs in via OAuth (primary)
// or pastes a token (secondary). Both paths land here.
//
// When signed in via OAuth we also persist the refresh material (refresh_token,
// token_endpoint, client_id, issuer, expiry) so the api layer can silently
// refresh the access token on a 401 — the user never re-signs-in unless the
// refresh itself fails.

const ORIGIN_KEY = 'pv.origin'
const TOKEN_KEY = 'pv.token'
const AUTH_KEY = 'pv.auth' // OAuth refresh material (JSON); absent for pasted tokens

export interface VaultConfig {
  origin: string
  token: string
}

// OAuth refresh material persisted next to the access token.
export interface OAuthAuth {
  method: 'oauth'
  issuer: string
  tokenEndpoint: string
  clientId: string
  refreshToken?: string
  scope?: string
  // Absolute UTC ms (Date.now() baseline) when the access token expires.
  expiresAt?: number
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

export function getConfig(): VaultConfig | null {
  const origin = localStorage.getItem(ORIGIN_KEY)
  const token = localStorage.getItem(TOKEN_KEY)
  if (!origin || !token) return null
  return { origin, token }
}

export function setConfig(cfg: VaultConfig): void {
  localStorage.setItem(ORIGIN_KEY, normalizeOrigin(cfg.origin))
  localStorage.setItem(TOKEN_KEY, cfg.token.trim())
}

export function getAuth(): OAuthAuth | null {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OAuthAuth
  } catch {
    return null
  }
}

export function setAuth(auth: OAuthAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

// Update the access token (+ rotated refresh material) in place after a refresh.
export function updateAccessToken(token: string, patch: Partial<OAuthAuth>): void {
  localStorage.setItem(TOKEN_KEY, token.trim())
  const existing = getAuth()
  if (existing) {
    setAuth({ ...existing, ...patch })
  }
}

export function isOAuth(): boolean {
  return getAuth() !== null
}

export function clearConfig(): void {
  localStorage.removeItem(ORIGIN_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(AUTH_KEY)
}

export function hasConfig(): boolean {
  return getConfig() !== null
}
