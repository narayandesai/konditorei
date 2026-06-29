import { useEffect, useRef, useState } from 'react'
import { EditorView, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { api } from '../lib/api.js'
import type { PublicPlayerResponse } from '../types.js'
import * as strudel from '../lib/strudel.js'
import type { StrudelError } from '../lib/strudel.js'
import { Visualizer } from './Visualizer.js'

export function Player({ slug }: { slug: string }) {
  const [status, setStatus] = useState<'loading' | 'not-found' | 'ready'>('loading')
  const [data, setData] = useState<PublicPlayerResponse | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.publications.getBySlug(slug)
      .then((d) => { setData(d); setStatus('ready') })
      .catch(() => setStatus('not-found'))
  }, [slug])

  useEffect(() => {
    if (status !== 'ready' || !data || data.show_code !== 1 || !editorContainerRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: data.code,
        extensions: [
          javascript(),
          oneDark,
          lineNumbers(),
          EditorState.readOnly.of(true),
          EditorView.lineWrapping,
        ],
      }),
      parent: editorContainerRef.current,
    })
    return () => view.destroy()
  }, [status, data?.show_code, data?.code])

  function handleError(e: StrudelError) {
    setError(e.message)
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)', fontSize: 14 }}>
        This publication doesn't exist or has been removed.
      </div>
    )
  }

  const d = data!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: 32, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{d.song_name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            by {d.publisher_name} · v{d.version_number}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {!isPlaying ? (
            <button
              onClick={() => {
                strudel.evaluate(d.code, handleError)
                  .then(() => { strudel.start(handleError); setIsPlaying(true) })
                  .catch((e: unknown) => handleError({ message: String(e) }))
              }}
              style={{ background: 'var(--green)', border: 'none', color: '#fff', padding: '6px 20px', borderRadius: 4, fontSize: 14 }}
            >
              ▶ Play
            </button>
          ) : (
            <button
              onClick={() => { strudel.stop(); setIsPlaying(false) }}
              style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 20px', borderRadius: 4, fontSize: 14 }}
            >
              ■ Stop
            </button>
          )}
        </div>

        <Visualizer type="scope" isPlaying={isPlaying} />

        {d.show_code === 1 && (
          <div ref={editorContainerRef} style={{ marginTop: 16, borderRadius: 6, overflow: 'hidden' }} />
        )}
      </div>

      {error && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: 'var(--red)', color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#fff' }}>×</button>
        </div>
      )}
    </div>
  )
}
