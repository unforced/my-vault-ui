import { useEffect, useMemo, useRef, useState } from 'react'
import { createNote } from '../vault/api'
import type { Note } from '../vault/types'
import { subscribeNotes } from '../vault/sse'
import { Markdown } from '../components/Markdown'

const CH_TAG = '#channel-message'
const CHANNEL_KEY = 'pv.channel'

const tsOf = (n: Note) => String(n.metadata?.ts ?? n.createdAt ?? '')
function isOutbound(n: Note): boolean {
  const d = String(n.metadata?.direction ?? '')
  if (d) return d === 'outbound'
  return (n.tags ?? []).some((t) => t.endsWith('/outbound'))
}

// The channels organ — talking to the Claude session through the vault, live.
// A message is a #channel-message note; sending writes an inbound note, the
// connected session replies with an outbound one, and both arrive in realtime
// over the SSE subscription (no polling). Aaron's messages right, Uni's left.
export function Channels() {
  const [channel, setChannel] = useState(() => localStorage.getItem(CHANNEL_KEY) || 'uni')
  const [msgs, setMsgs] = useState<Map<string, Note>>(new Map())
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [live, setLive] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const inChannel = (n: Note) => String(n.metadata?.channel ?? '') === channel
    const unsub = subscribeNotes(
      { tag: CH_TAG },
      {
        onSnapshot: (notes) => {
          const m = new Map<string, Note>()
          for (const n of notes) if (inChannel(n)) m.set(n.id, n)
          setMsgs(m)
          setLive(true)
        },
        onUpsert: (n) =>
          setMsgs((prev) => {
            if (!inChannel(n)) return prev
            const next = new Map(prev)
            next.set(n.id, n)
            return next
          }),
        onRemove: (id) =>
          setMsgs((prev) => {
            const next = new Map(prev)
            next.delete(id)
            return next
          }),
        onError: () => setLive(false),
      },
    )
    return unsub
  }, [channel])

  const ordered = useMemo(
    () => [...msgs.values()].sort((a, b) => tsOf(a).localeCompare(tsOf(b))),
    [msgs],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ordered.length])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const ts = new Date().toISOString()
    try {
      await createNote({
        path: `Channels/${channel}/${ts.replace(/[:.]/g, '-')}`,
        content: body,
        tags: [CH_TAG, `${CH_TAG}/inbound`],
        metadata: { channel, direction: 'inbound', sender: 'aaron', ts },
      })
      setText('')
    } finally {
      setSending(false)
    }
  }

  function switchChannel() {
    const c = window.prompt('Channel name', channel)
    if (c && c.trim()) {
      const v = c.trim()
      localStorage.setItem(CHANNEL_KEY, v)
      setMsgs(new Map())
      setLive(false)
      setChannel(v)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 740 }}>
      <div className="page-head">
        <div className="kicker">channels · how we talk</div>
        <h1>
          #{channel}
          <button className="rename-trigger" onClick={switchChannel}>switch</button>
        </h1>
        <p className="sub">
          <span className={`chat-dot${live ? ' on' : ''}`} />
          {live ? 'Live — talk to Uni; replies arrive in realtime.' : 'Connecting…'}
        </p>
      </div>

      <div className="chat">
        {ordered.length === 0 && live && (
          <p className="chat-empty">No messages yet on #{channel}. Say something to begin.</p>
        )}
        {ordered.map((m) => {
          const out = isOutbound(m)
          return (
            <div key={m.id} className={`chat-row ${out ? 'out' : 'in'}`}>
              <div className="chat-bubble">
                <Markdown content={m.content ?? ''} />
                <span className="chat-ts">
                  {tsOf(m) ? new Date(tsOf(m)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message #${channel}…  (⌘↵ to send)`}
          rows={2}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button className="btn" onClick={send} disabled={!text.trim() || sending}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
