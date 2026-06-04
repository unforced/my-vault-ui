import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNote, listSurfaces, resolveSurface } from '../vault/api'
import type { Note } from '../vault/types'
import { useAsync } from '../vault/useAsync'
import { openCapture, CAPTURE_CREATED_EVENT } from '../App'
import { Markdown } from './Markdown'
import { Seed } from './icons'

// The bold lead of a surface ("**The work.** …") → a short label for the reply
// chip + a11y. Falls back to the path leaf.
function surfaceLabel(s: Note): string {
  const m = (s.content ?? '').match(/\*\*(.+?)\*\*/)
  const lead = (m?.[1] ?? '').trim().replace(/\.$/, '')
  return lead || (s.path.split('/').pop() ?? 'this')
}

// One open surface: the prompt, a Respond (threads + auto-resolves), and a quiet
// Resolve (clear it without answering). Resolving/answering drops it from view.
function SurfaceCard({ surface, onChanged }: { surface: Note; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const label = surfaceLabel(surface)
  const domain = surface.metadata?.domain ? String(surface.metadata.domain) : null

  async function resolve() {
    setBusy(true)
    try {
      await resolveSurface(surface.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mq">
      {domain && <span className="mq-domain">{domain}</span>}
      <div className="mq-body">
        <Markdown content={surface.content ?? ''} />
      </div>
      <div className="mq-actions">
        <button
          className="mq-respond"
          onClick={() => openCapture({ id: surface.id, label, resolveOnReply: true })}
        >
          Respond <span className="mq-respond-arrow">↩</span>
        </button>
        <button className="mq-resolve" onClick={resolve} disabled={busy}>
          {busy ? 'Resolving…' : 'Resolve'}
        </button>
      </div>
    </div>
  )
}

// The morning surface on Today: the AI's open prompts as answerable cards — the
// front-end of the conversational loop. Each card threads a reply back
// (responds-to) and auto-resolves on answer; Resolve clears one you'd rather
// skip. Pulls live from the `surface/*` notes the Weaver tends.
export function MorningCard() {
  const surfaces = useAsync(() => listSurfaces(), [])
  const now = useAsync(() => getNote('Now').catch(() => null), [])

  // Re-pull when a capture lands or syncs, so an answered prompt drops away.
  useEffect(() => {
    const reload = () => surfaces.reload()
    window.addEventListener(CAPTURE_CREATED_EVENT, reload)
    window.addEventListener('pv:capture-synced', reload)
    return () => {
      window.removeEventListener(CAPTURE_CREATED_EVENT, reload)
      window.removeEventListener('pv:capture-synced', reload)
    }
    // reload is stable from useAsync; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all = surfaces.data ?? []
  const open = all.filter((s) => (s.metadata?.state ?? 'open') === 'open')
  const resolvedCount = all.length - open.length
  const hasNow = Boolean(now.data)

  // Nothing to show until we know there are surfaces (graceful before first weave).
  if (!surfaces.loading && all.length === 0 && !hasNow) return null

  return (
    <section className="morning-card">
      <div className="morning-head">
        <span className="morning-glyph"><Seed size={18} /></span>
        <h2>This morning</h2>
        {resolvedCount > 0 && (
          <span className="morning-resolved" title="Prompts you've answered or cleared">
            {resolvedCount} resolved
          </span>
        )}
      </div>

      {open.length > 0 ? (
        <div className="morning-questions">
          {open.map((s) => (
            <SurfaceCard key={s.id} surface={s} onChanged={() => surfaces.reload()} />
          ))}
        </div>
      ) : surfaces.loading ? (
        <p className="morning-quiet">Gathering this morning's prompts…</p>
      ) : (
        <p className="morning-quiet">All clear — nothing waiting. The next weave will pose fresh prompts.</p>
      )}

      <div className="morning-foot">
        <button className="morning-respond" onClick={() => openCapture()}>
          Capture something else
        </button>
        {hasNow && (
          <Link className="morning-now" to="/note/Now">
            What's alive now →
          </Link>
        )}
      </div>
    </section>
  )
}
