import { getConfig } from './config'
import type { Note } from './types'

// Live-query a tag-scoped note set over Server-Sent Events. The vault sends one
// `snapshot` (the current match), then `upsert`/`remove` as notes change — so a
// view can be live and drop polling. EventSource can't set headers, so the read
// token rides as `?key`. Reconnect = re-subscribe (the fresh snapshot
// self-corrects; no replay yet). `search`/`near` queries are rejected (400).
//
// Thin local helper for now; to be upstreamed as VaultClient.subscribe().
export interface SubscribeHandlers {
  onSnapshot: (notes: Note[]) => void
  onUpsert: (note: Note) => void
  onRemove: (id: string) => void
  onError?: () => void
}

export function subscribeNotes(
  query: Record<string, string>,
  h: SubscribeHandlers,
): () => void {
  const cfg = getConfig()
  if (!cfg || typeof EventSource === 'undefined') return () => {}
  const qs = new URLSearchParams(query)
  qs.set('key', cfg.token)
  const es = new EventSource(`${cfg.origin}/api/subscribe?${qs.toString()}`)
  es.addEventListener('snapshot', (e) =>
    h.onSnapshot(JSON.parse((e as MessageEvent).data).notes ?? []),
  )
  es.addEventListener('upsert', (e) => h.onUpsert(JSON.parse((e as MessageEvent).data).note))
  es.addEventListener('remove', (e) => h.onRemove(JSON.parse((e as MessageEvent).data).id))
  if (h.onError) es.onerror = () => h.onError?.()
  return () => es.close()
}
