import { getNote } from '../vault/api'
import type { Note } from '../vault/types'
import { captureKindOf } from '../vault/types'
import { useAsync } from '../vault/useAsync'
import { AudioEmbed } from './AudioEmbed'
import { Markdown } from './Markdown'
import { Loading, ErrorBanner, EntityChip } from './common'
import { CloseIcon, captureGlyph, VoiceGlyph } from './icons'
import {
  findAudioEmbed,
  audioAttachmentOf,
  transcriptOf,
  linkedEntities,
  formatDayHeading,
  dayKey,
  formatTime,
  stripEmbeds,
} from '../vault/util'

// Read-only full-note viewer for one capture — opened from the Proposals review
// so the human can read the WHOLE note (content as markdown, audio player for a
// voice memo, date/path, and existing entity links) before deciding whether to
// link it. Distinct from CaptureTriage (the owner's editable triage); this view
// never mutates and reuses the same overlay/panel styling.
//
// `seed` is the lean row note (for an instant header); we fetch the full note
// WITH links + attachments so the player and link chips are accurate.
export function CaptureView({
  seed,
  onClose,
}: {
  seed: Note
  onClose: () => void
}) {
  const { data, loading, error, reload } = useAsync(
    () => getNote(seed.id, { includeLinks: true, includeAttachments: true }),
    [seed.id],
  )

  const note = data ?? seed
  const kind = captureKindOf(note)
  const body = stripEmbeds(note.content ?? '')

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel triage" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span style={{ color: 'var(--clay)' }}>{captureGlyph(kind)}</span>
          <h3>Full note</h3>
          <button className="icon-btn x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="panel-body">
          <div className="triage-meta">
            <span className="kind">{kind === 'voice' ? 'voice' : kind === 'dream' ? 'dream' : 'note'}</span>
            <span>·</span>
            <span>
              {formatDayHeading(dayKey(note.createdAt))} · {formatTime(note.createdAt)}
            </span>
          </div>
          <p className="cv-path">{note.path}</p>

          {loading && <Loading label="Opening the full note…" />}
          {Boolean(error) && <ErrorBanner error={error} onRetry={reload} />}

          {data && (
            <>
              {/* ── Attachment / audio (voice notes) ── */}
              {(() => {
                const embed = note.content ? findAudioEmbed(note.content) : null
                const att = audioAttachmentOf(note.attachments)
                if (!att && !embed) return null
                const transcript = transcriptOf(att)
                const status = att?.metadata?.transcribe_status
                const pending = !transcript && (status === 'pending' || status === 'processing')
                return (
                  <div className="triage-section">
                    <p className="field-label">Attachment</p>
                    <AudioEmbed attachment={att} file={embed ?? undefined} />
                    {transcript ? (
                      <blockquote className="transcript">{transcript}</blockquote>
                    ) : pending ? (
                      <p className="transcript-pending">Transcribing…</p>
                    ) : null}
                  </div>
                )
              })()}

              {/* ── Full content (markdown) ── */}
              <div className="triage-section">
                <p className="field-label">Note</p>
                {body ? (
                  <Markdown content={note.content ?? ''} />
                ) : (
                  <p className="touching-empty">
                    <span style={{ color: 'var(--ink-faint)', marginRight: 6 }}>
                      <VoiceGlyph />
                    </span>
                    (no text content)
                  </p>
                )}
              </div>

              {/* ── Existing entity links ── */}
              <div className="triage-section">
                <p className="field-label">Woven into</p>
                {(() => {
                  const linked = linkedEntities(note)
                  return linked.length === 0 ? (
                    <p className="touching-empty">Not woven yet.</p>
                  ) : (
                    <div className="chips">
                      {linked.map((l) => (
                        <EntityChip key={l.ref.id} entity={l.ref} relationship={l.relationship} showRel />
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
