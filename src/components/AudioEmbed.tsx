import { useEffect, useState } from 'react'
import { fetchStorageBlob, type Attachment } from '../vault/api'
import { VoiceGlyph } from './icons'

// Real audio player for a voice capture. The storage endpoint needs the Bearer
// header, so a bare <audio src> can't reach it — we fetch the blob WITH auth,
// turn it into an object URL, and feed that to <audio>. The object URL is
// revoked on unmount / when the source changes so we don't leak blob handles.
//
// `attachment` is the note's audio attachment (a voice note typically has
// exactly one); its `path` is the storage path we fetch. `file` is the
// ![[memo-*.webm]] embed name, shown as a label and used as a fallback caption.

export function AudioEmbed({
  attachment,
  file,
}: {
  attachment?: Attachment | null
  file?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const path = attachment?.path ?? null
  const label = file ?? (path ? path.split('/').pop() : undefined)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    let objectUrl: string | null = null
    fetchStorageBlob(path)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setError(null)
        setUrl(objectUrl)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load audio')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  // No attachment to play — calm note rather than a broken control.
  if (!path) {
    return (
      <div className="audio-block">
        <span style={{ color: 'var(--clay)' }}>
          <VoiceGlyph />
        </span>
        <span className="audio-missing">
          {label ? (
            <>Voice memo <code>{label}</code> — no audio attachment found.</>
          ) : (
            'Voice memo — no audio attachment found.'
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="audio-block">
      <span style={{ color: 'var(--clay)' }}>
        <VoiceGlyph />
      </span>
      {error ? (
        <span className="audio-missing">Couldn't load audio — {error}</span>
      ) : url ? (
        <audio controls src={url} />
      ) : (
        <span className="audio-missing">Loading audio…</span>
      )}
    </div>
  )
}
