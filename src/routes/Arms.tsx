import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../vault/useAsync'
import { Loading, ErrorBanner, EmptyState } from '../components/common'
import { formatRelative } from '../vault/util'
import {
  fetchArmRoster,
  listOutboundMessages,
  lastOutboundByChannel,
  statusDotClass,
  selectChannel,
  seenMap,
} from '../vault/channels'

// The arms roster — every Uni arm with its mandate, channel, pulse (last
// outbound) and unread count. Read-only: arms are born and retired elsewhere;
// this is the window, not the lever.
export function Arms() {
  const roster = useAsync(() => fetchArmRoster(), [])
  // ONE query for all outbound messages; per-arm stats are grouped client-side.
  const outbound = useAsync(() => listOutboundMessages(), [])

  const lastBy = useMemo(() => lastOutboundByChannel(outbound.data ?? []), [outbound.data])

  // channel → outbound messages Aaron hasn't seen yet (Home/Channels mark seen).
  const unreadBy = useMemo(() => {
    const seen = seenMap()
    const counts = new Map<string, number>()
    for (const n of outbound.data ?? []) {
      if (seen[n.id]) continue
      const c = String(n.metadata?.channel ?? '')
      if (!c) continue
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return counts
  }, [outbound.data])

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div className="kicker">the octopus</div>
        <h1>Arms</h1>
        <p className="sub">Every arm of Uni — its mandate, its channel, and when it last spoke.</p>
      </div>

      {roster.loading && <Loading label="Reading the roster…" />}
      {Boolean(roster.error) && <ErrorBanner error={roster.error} onRetry={roster.reload} />}
      {roster.data && roster.data.length === 0 && (
        <EmptyState art="🐙" title="No arms yet">
          When arm mandate notes land under <code>Uni/Arms/</code>, they'll gather here.
        </EmptyState>
      )}

      <div className="arms-list">
        {(roster.data ?? []).map((a) => {
          const last = lastBy.get(a.channel)
          const unread = unreadBy.get(a.channel) ?? 0
          return (
            <div key={a.channel} className="arm-row">
              <div className="arm-main">
                <div className="arm-name">
                  <span className={`status-dot ${statusDotClass(a.status)}`} />
                  {a.name}
                  {a.status && <span className="arm-status">{a.status}</span>}
                </div>
                {a.summary && <div className="arm-summary">{a.summary}</div>}
              </div>
              <div className="arm-side">
                <Link className="arm-chan" to="/channels" onClick={() => selectChannel(a.channel)}>
                  #{a.channel}
                  {unread > 0 && <span className="arm-unread">{unread}</span>}
                </Link>
                <span className="arm-last">
                  {last ? `last spoke ${formatRelative(last)}` : 'no messages yet'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
