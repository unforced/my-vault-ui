import { Link } from 'react-router-dom'
import { getNote } from '../vault/api'
import { useAsync } from '../vault/useAsync'
import { Markdown } from './Markdown'

// Pull a "## Heading" section's body out of a note's markdown.
function section(content: string, heading: string): string {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase())
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break }
  }
  return lines.slice(start + 1, end).join('\n').trim()
}

// "What needs done" — the orient-here panel on Today. v1 surfaces the Weaver's
// curated "Loops that matter this week" from Now (each linked to its endeavor),
// so the day opens on what matters. (Per-endeavor open-loops can layer in next.)
export function FocusPanel() {
  const { data } = useAsync(() => getNote('Now').catch(() => null), [])
  if (!data) return null
  const loops = section(data.content ?? '', 'Loops that matter this week')
  if (!loops) return null
  return (
    <section className="focus-panel">
      <div className="focus-head">
        <h2>What needs done</h2>
        <Link className="focus-all" to="/note/Now">this week →</Link>
      </div>
      <div className="focus-loops">
        <Markdown content={loops} />
      </div>
    </section>
  )
}
