import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNote } from '../vault/api'
import type { Note } from '../vault/types'
import { captureKindOf } from '../vault/types'
import { useAsync } from '../vault/useAsync'
import { Markdown } from '../components/Markdown'
import { AudioEmbed } from '../components/AudioEmbed'
import { WeaveEditor } from '../components/WeaveEditor'
import { Loading, ErrorBanner, EntityChip, Toast } from '../components/common'
import { BackIcon, captureGlyph, LinkIcon } from '../components/icons'
import {
  findAudioEmbed,
  audioAttachmentOf,
  transcriptOf,
  linkedEntities,
  formatDayHeading,
  dayKey,
  formatTime,
} from '../vault/util'

export function CaptureDetail() {
  const { id = '' } = useParams()
  const [weaving, setWeaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { data, loading, error, reload } = useAsync(
    () => getNote(decodeURIComponent(id), { includeLinks: true, includeAttachments: true }),
    [id],
  )

  function onWoven(_updated: Note) {
    setWeaving(false)
    setToast('Woven 🌿')
    setTimeout(() => setToast(null), 2000)
    reload()
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <Link to="/" className="back-link">
        <BackIcon /> Today
      </Link>

      {loading && <Loading />}
      {Boolean(error) && <ErrorBanner error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="capture-meta" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--clay)' }}>{captureGlyph(captureKindOf(data))}</span>
            <span className="kind">{captureKindOf(data) ?? 'note'}</span>
            <span>·</span>
            <span>
              {formatDayHeading(dayKey(data.createdAt))} · {formatTime(data.createdAt)}
            </span>
          </div>

          {(() => {
            const embed = data.content ? findAudioEmbed(data.content) : null
            const att = audioAttachmentOf(data.attachments)
            // Render a player whenever there's an audio attachment OR an embed
            // (a fresh voice capture mid-transcription may have one but not yet
            // the other). Skip only when there's nothing audio at all.
            if (!att && !embed) return null
            const transcript = transcriptOf(att)
            const transcribeStatus = att?.metadata?.transcribe_status
            const pending =
              !transcript &&
              (transcribeStatus === 'pending' || transcribeStatus === 'processing')
            return (
              <>
                <AudioEmbed attachment={att} file={embed ?? undefined} />
                {transcript ? (
                  <blockquote className="transcript">{transcript}</blockquote>
                ) : pending ? (
                  <p className="transcript-pending">Transcribing…</p>
                ) : null}
              </>
            )
          })()}

          {data.content ? (
            <Markdown content={data.content} />
          ) : (
            <p style={{ color: 'var(--ink-faint)' }}>(no text content)</p>
          )}

          {/* Links */}
          <div style={{ marginTop: 30 }}>
            <div className="section-title">Woven into</div>
            {(() => {
              const linked = linkedEntities(data)
              if (linked.length === 0) {
                return (
                  <p style={{ color: 'var(--ink-soft)' }}>
                    Not woven yet.{' '}
                    <button
                      className="text-toggle"
                      onClick={() => setWeaving(true)}
                      style={{ display: 'inline' }}
                    >
                      Weave it now →
                    </button>
                  </p>
                )
              }
              return (
                <>
                  <div className="chips">
                    {linked.map((l) => (
                      <EntityChip key={l.ref.id} entity={l.ref} relationship={l.relationship} showRel />
                    ))}
                  </div>
                  <button className="btn-ghost btn" style={{ marginTop: 16 }} onClick={() => setWeaving(true)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <LinkIcon /> Add more links
                    </span>
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {weaving && data && (
        <WeaveEditor capture={data} onClose={() => setWeaving(false)} onWoven={onWoven} />
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}
