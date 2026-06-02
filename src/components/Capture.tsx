import { useCallback, useEffect, useRef, useState } from 'react'
import { createNote, uploadStorageFile, addAttachment } from '../vault/api'
import type { Note } from '../vault/types'
import { capturePath, memoFilename } from '../vault/util'
import { CloseIcon, TextGlyph, VoiceGlyph } from './icons'

// "New capture" modal — text or voice, mirroring the Notes compose flow.
//
// Text: markdown textarea → POST /api/notes (tags: capture/text).
// Voice: MediaRecorder(audio/webm;codecs=opus) → on stop, upload the blob to
//   /api/storage/upload, create a note embedding ![[memo-*.webm]], then attach
//   the uploaded file with transcribe:true (transcription fills content/
//   metadata.transcript async). The capture shows "transcribing…" meanwhile.

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return null
}

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type Mode = 'choose' | 'text' | 'voice'
type VoicePhase = 'idle' | 'recording' | 'saving'

export function Capture({
  onClose,
  onCreated,
}: {
  onClose: () => void
  // Called once a capture lands. `note` is the created note; the host refreshes
  // its list and may offer to weave it.
  onCreated: (note: Note) => void
}) {
  const [mode, setMode] = useState<Mode>('choose')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── voice state ──
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const mimeRef = useRef<string>('audio/webm;codecs=opus')

  // tick the elapsed timer while recording
  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250)
    return () => clearInterval(id)
  }, [phase])

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Release the mic if the modal unmounts mid-recording.
  useEffect(() => () => releaseMic(), [releaseMic])

  // ── text submit ──
  async function submitText() {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    setError(null)
    try {
      const note = await createNote({
        path: capturePath('text'),
        content,
        tags: ['capture/text'],
        metadata: {},
      })
      onCreated(note)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  // ── voice: start ──
  async function startRecording() {
    setError(null)
    const mimeType = pickMimeType()
    if (!mimeType) {
      setError("This browser can't record audio in a format we can save.")
      return
    }
    mimeRef.current = mimeType
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = rec
      rec.start()
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setPhase('recording')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(
        name === 'NotFoundError'
          ? 'No microphone was found on this device.'
          : name === 'NotAllowedError'
            ? 'Microphone access was denied. Update your browser settings to record.'
            : e instanceof Error
              ? e.message
              : 'Microphone is not available in this browser.',
      )
      releaseMic()
    }
  }

  function cancelRecording() {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    releaseMic()
    setPhase('idle')
    setElapsedMs(0)
  }

  // ── voice: stop → upload → note → attach ──
  async function stopAndSave() {
    const rec = recorderRef.current
    if (!rec || phase !== 'recording') return
    setPhase('saving')
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeRef.current }))
      rec.stop()
    })
    releaseMic()
    recorderRef.current = null

    try {
      const filename = memoFilename(mimeRef.current)
      const file = new File([blob], filename, { type: mimeRef.current })
      // 1. upload the blob → stored path
      const uploaded = await uploadStorageFile(file)
      // 2. create the note embedding the memo
      const note = await createNote({
        path: capturePath('voice'),
        content: `![[${filename}]]`,
        tags: ['capture/voice'],
        metadata: {},
      })
      // 3. attach + kick off transcription (fills content/transcript async)
      await addAttachment(note.id, {
        path: uploaded.path,
        mimeType: 'audio/webm;codecs=opus',
        transcribe: true,
      })
      onCreated(note)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('idle')
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span style={{ color: 'var(--clay)' }}>
            {mode === 'voice' ? <VoiceGlyph /> : <TextGlyph />}
          </span>
          <h3>
            {mode === 'choose'
              ? 'New capture'
              : mode === 'text'
                ? 'Write a capture'
                : 'Voice capture'}
          </h3>
          <button className="icon-btn x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="panel-body">
          {mode === 'choose' && (
            <div className="capture-modes">
              <button className="capture-mode" onClick={() => setMode('text')}>
                <span className="cm-glyph"><TextGlyph /></span>
                <span className="cm-label">Text</span>
                <span className="cm-sub">Type a thought in markdown</span>
              </button>
              <button className="capture-mode" onClick={() => setMode('voice')}>
                <span className="cm-glyph"><VoiceGlyph /></span>
                <span className="cm-label">Voice</span>
                <span className="cm-sub">Record &amp; transcribe a memo</span>
              </button>
            </div>
          )}

          {mode === 'text' && (
            <>
              <textarea
                className="capture-textarea"
                autoFocus
                placeholder="What's alive right now? (markdown welcome — [[link]] later in Weave)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submitText()
                }}
              />
              {error && <div className="config-err" style={{ marginTop: 12 }}>{error}</div>}
              <div className="btn-row">
                <button className="btn-ghost btn" onClick={() => setMode('choose')}>
                  Back
                </button>
                <div className="spacer" />
                <button className="btn" disabled={!text.trim() || saving} onClick={submitText}>
                  {saving ? 'Capturing…' : 'Capture'}
                </button>
              </div>
            </>
          )}

          {mode === 'voice' && (
            <>
              {phase === 'idle' && (
                <div className="voice-stage">
                  <p className="voice-hint">
                    Tap record, speak freely, then stop. We'll save the audio and
                    transcribe it for you.
                  </p>
                  {error && <div className="config-err">{error}</div>}
                  <div className="btn-row">
                    <button className="btn-ghost btn" onClick={() => setMode('choose')}>
                      Back
                    </button>
                    <div className="spacer" />
                    <button className="btn" onClick={startRecording}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <VoiceGlyph /> Record
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {phase === 'recording' && (
                <div className="voice-stage recording">
                  <div className="rec-pulse" aria-hidden />
                  <div className="rec-elapsed">{fmtElapsed(elapsedMs)}</div>
                  <p className="voice-hint">Recording… speak naturally.</p>
                  <div className="btn-row">
                    <button className="btn-ghost btn" onClick={cancelRecording}>
                      Cancel
                    </button>
                    <div className="spacer" />
                    <button className="btn" onClick={stopAndSave}>
                      Stop &amp; save
                    </button>
                  </div>
                </div>
              )}

              {phase === 'saving' && (
                <div className="voice-stage">
                  <div className="breathing" />
                  <p className="voice-hint" style={{ marginTop: 16 }}>
                    Saving your memo &amp; starting transcription…
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
