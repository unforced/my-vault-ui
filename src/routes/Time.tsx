import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { listNotes } from '../vault/api'
import { useAsync } from '../vault/useAsync'
import { CaptureCard } from '../components/CaptureCard'
import { Loading, ErrorBanner, EmptyState } from '../components/common'
import { groupByDay, formatDayHeading } from '../vault/util'

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

type Grain = 'year' | 'month' | 'day'
const grainOf = (w: string): Grain => {
  const dashes = (w.match(/-/g) ?? []).length
  return dashes === 0 ? 'year' : dashes === 1 ? 'month' : 'day'
}

// [from, to) ISO-date window for a YYYY / YYYY-MM / YYYY-MM-DD key.
function range(w: string): { from: string; to: string } {
  const g = grainOf(w)
  if (g === 'year') {
    const y = Number(w)
    return { from: `${y}-01-01`, to: `${y + 1}-01-01` }
  }
  if (g === 'month') {
    const [y, m] = w.split('-').map(Number)
    const ny = m === 12 ? y + 1 : y
    const nm = m === 12 ? 1 : m + 1
    return { from: `${w}-01`, to: `${ny}-${String(nm).padStart(2, '0')}-01` }
  }
  const d = new Date(`${w}T00:00:00Z`)
  const next = new Date(d.getTime() + 86400000)
  return { from: w, to: next.toISOString().slice(0, 10) }
}

function label(w: string): string {
  const g = grainOf(w)
  if (g === 'year') return w
  const [y, m] = w.split('-').map(Number)
  if (g === 'month') return `${MONTHS[m]} ${y}`
  return new Date(`${w}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function shift(w: string, dir: number): string {
  const g = grainOf(w)
  if (g === 'year') return String(Number(w) + dir)
  if (g === 'month') {
    let [y, m] = w.split('-').map(Number)
    m += dir
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const d = new Date(`${w}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dir)
  return d.toISOString().slice(0, 10)
}

const parentWindow = (w: string): string | null => {
  const g = grainOf(w)
  if (g === 'day') return w.slice(0, 7)
  if (g === 'month') return w.slice(0, 4)
  return null
}
function synthPath(w: string): string | null {
  const g = grainOf(w)
  const [y, m] = w.split('-')
  if (g === 'month') return `Summaries/${y}/${m}`
  if (g === 'year') return `Summaries/${y}/_year`
  return null
}

// Navigate the vault by time — a window (year / month / day) of raw captures,
// grouped by day, with prev/next at the same grain, zoom-out, a jump-to-any-date
// picker, and one click to that window's synthesis. The "zoom into my own mind"
// surface: from the Arc down to what you were actually capturing on a given day.
export function Time() {
  const { window: w = '' } = useParams()
  const nav = useNavigate()
  const { from, to } = useMemo(() => range(w), [w])
  const caps = useAsync(
    () => listNotes({ tag: 'capture', dateFrom: from, dateTo: to, includeContent: true, includeLinks: true, sort: 'asc', limit: 400 }),
    [from, to],
  )
  const days = useMemo(() => groupByDay(caps.data ?? []), [caps.data])
  const g = grainOf(w)
  const parent = parentWindow(w)
  const synth = synthPath(w)
  const [jump, setJump] = useState(g === 'day' ? w : '')

  const grainWord = g === 'day' ? 'day' : g === 'month' ? 'month' : 'year'

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div className="kicker">a window in time</div>
        <h1>{label(w)}</h1>
        <div className="time-nav">
          <button className="time-arrow" onClick={() => nav(`/time/${shift(w, -1)}`)}>← prev {grainWord}</button>
          <button className="time-arrow" onClick={() => nav(`/time/${shift(w, 1)}`)}>next {grainWord} →</button>
          {parent && <Link className="time-zoom" to={`/time/${parent}`}>zoom out</Link>}
          <Link className="time-zoom" to="/arc">the Arc</Link>
          {synth && <Link className="time-zoom time-synth" to={`/note/${encodeURIComponent(synth)}`}>the synthesis →</Link>}
          <label className="time-jump">
            jump to
            <input
              type="date"
              value={jump}
              onChange={(e) => { setJump(e.target.value); if (e.target.value) nav(`/time/${e.target.value}`) }}
            />
          </label>
        </div>
      </div>

      {caps.loading && <Loading label="Gathering that time…" />}
      {Boolean(caps.error) && <ErrorBanner error={caps.error} onRetry={caps.reload} />}
      {caps.data && days.length === 0 && !caps.loading && (
        <EmptyState art="🕰" title="Nothing captured then">
          No captures in this window — try the months around it.
        </EmptyState>
      )}

      {days.map((d) => (
        <div className="day-group" key={d.key}>
          <h2 className="day-heading">
            {formatDayHeading(d.key)}
            <span className="count">{d.items.length}</span>
          </h2>
          <div className="spine">
            {d.items.map((c) => (
              <CaptureCard key={c.id} note={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
