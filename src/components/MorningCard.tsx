import { Link } from 'react-router-dom'
import { getNote } from '../vault/api'
import { useAsync } from '../vault/useAsync'
import { openCapture } from '../App'
import { Markdown } from './Markdown'
import { Seed } from './icons'

// Pull a "## Heading" section's body out of a note's markdown.
function section(content: string, heading: string): string {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase())
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join('\n').trim()
}

// The morning surface on Today: the live Open Inquiry questions + a quiet link
// into Now. The front-end of the daily tending loop — the first thing you see.
// Renders nothing if neither note exists yet (graceful before the first weave).
export function MorningCard() {
  const { data } = useAsync(async () => {
    const [now, inquiry] = await Promise.allSettled([getNote('Now'), getNote('Open Inquiry')])
    return {
      now: now.status === 'fulfilled' ? now.value : null,
      inquiry: inquiry.status === 'fulfilled' ? inquiry.value : null,
    }
  }, [])

  if (!data || (!data.now && !data.inquiry)) return null

  const inquiryBody = data.inquiry?.content ?? ''
  const morning = section(inquiryBody, 'This morning')
  const throughline = section(data.now?.content ?? '', 'The throughline')

  return (
    <section className="morning-card">
      <div className="morning-head">
        <span className="morning-glyph"><Seed size={18} /></span>
        <h2>This morning</h2>
        {data.inquiry && (
          <Link className="morning-all" to="/note/Open%20Inquiry">
            Open Inquiry →
          </Link>
        )}
      </div>

      {morning ? (
        <div className="morning-questions">
          <Markdown content={morning} />
        </div>
      ) : data.inquiry ? (
        <p className="morning-quiet">No questions waiting — a quiet morning.</p>
      ) : null}

      <div className="morning-foot">
        <button className="morning-respond" onClick={openCapture}>
          Respond — capture a thought
        </button>
        {data.now && (
          <Link className="morning-now" to="/note/Now" title={throughline}>
            What's alive now →
          </Link>
        )}
      </div>
    </section>
  )
}
