import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getNote, patchNote } from '../vault/api'
import { useAsync } from '../vault/useAsync'
import { Markdown } from './Markdown'

// One checklist loop parsed out of Now's "Loops that matter this week" — its
// absolute line index (for surgical writeback), checked state, and text.
interface Loop { line: number; checked: boolean; text: string }

function parseLoops(content: string): Loop[] {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === '## loops that matter this week')
  if (start < 0) return []
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break }
  }
  const items: Loop[] = []
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\s*-\s*\[([ xX])\]\s*(.*)$/)
    if (m) items.push({ line: i, checked: m[1].toLowerCase() === 'x', text: m[2] })
  }
  return items
}

// "What needs done" — the orient-here panel on Today. Surfaces the Weaver's
// "Loops that matter this week" from Now as a LIVE checklist: tick one and it
// writes `- [x]` straight back to Now; the next weave clears the done ones.
export function FocusPanel() {
  const { data } = useAsync(() => getNote('Now').catch(() => null), [])
  // Optimistic local edits layer over the fetched Now content — no effect-mirror.
  const [localContent, setLocalContent] = useState<string | null>(null)
  const noteId = data?.id ?? null
  const content = localContent ?? data?.content ?? null

  if (!content || !noteId) return null
  const loops = parseLoops(content)
  if (loops.length === 0) return null

  async function toggle(item: Loop) {
    if (!content || !noteId) return
    const before = content
    const lines = content.split('\n')
    lines[item.line] = lines[item.line].replace(/\[[ xX]\]/, item.checked ? '[ ]' : '[x]')
    const next = lines.join('\n')
    setLocalContent(next) // optimistic
    try {
      await patchNote(noteId, { content: next })
    } catch {
      setLocalContent(before) // revert on failure
    }
  }

  return (
    <section className="focus-panel">
      <div className="focus-head">
        <h2>What needs done</h2>
        <Link className="focus-all" to="/note/Now">this week →</Link>
      </div>
      <div className="focus-loops">
        {loops.map((item) => (
          <label key={item.line} className={`focus-loop${item.checked ? ' done' : ''}`}>
            <input type="checkbox" checked={item.checked} onChange={() => toggle(item)} />
            <span className="focus-loop-text">
              <Markdown content={item.text} />
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
