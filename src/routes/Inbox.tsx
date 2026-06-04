import { useEffect, useState } from 'react'
import { listSurfaces } from '../vault/api'
import { useAsync } from '../vault/useAsync'
import { CAPTURE_CREATED_EVENT } from '../App'
import { SurfaceCard } from '../components/SurfaceCard'
import { Loading, ErrorBanner, EmptyState } from '../components/common'

// The "For You" stream: everything the AI has surfaced — open prompts and
// reflections to respond to, plus a foldable history of what you've resolved
// (with Reopen). A general view over the `surface/*` notes; Today shows just the
// open subset. As more surface kinds arrive (lessons, digests), they flow here.
export function Inbox() {
  const { data, loading, error, reload } = useAsync(() => listSurfaces(), [])
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    const r = () => reload()
    window.addEventListener(CAPTURE_CREATED_EVENT, r)
    window.addEventListener('pv:capture-synced', r)
    return () => {
      window.removeEventListener(CAPTURE_CREATED_EVENT, r)
      window.removeEventListener('pv:capture-synced', r)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all = data ?? []
  const open = all.filter((s) => (s.metadata?.state ?? 'open') === 'open')
  const resolved = all
    .filter((s) => s.metadata?.state === 'resolved')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div className="kicker">A living conversation</div>
        <h1>For You</h1>
        <p className="sub">
          What the vault is holding for you — riff on whatever pulls. Your replies thread back, and the
          next weave listens and re-poses.
        </p>
      </div>

      {loading && <Loading label="Gathering your surfaces…" />}
      {Boolean(error) && <ErrorBanner error={error} onRetry={reload} />}

      {data && open.length === 0 && resolved.length === 0 && (
        <EmptyState art="🌱" title="Nothing surfaced yet">
          When the Weaver poses a prompt or notices a pattern, it'll appear here.
        </EmptyState>
      )}

      {open.length > 0 && (
        <div className="inbox-list">
          {open.map((s) => (
            <SurfaceCard key={s.id} surface={s} onChanged={reload} />
          ))}
        </div>
      )}

      {data && open.length === 0 && resolved.length > 0 && (
        <p className="morning-quiet" style={{ marginBottom: 18 }}>
          All clear — nothing open right now.
        </p>
      )}

      {resolved.length > 0 && (
        <div className="inbox-resolved">
          <button className="text-toggle" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? 'Hide' : `Show ${resolved.length} resolved`}
          </button>
          {showResolved && (
            <div className="inbox-list" style={{ marginTop: 12 }}>
              {resolved.map((s) => (
                <SurfaceCard key={s.id} surface={s} onChanged={reload} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
