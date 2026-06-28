import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
// @ts-ignore — @strudel/codemirror ships no TypeScript declarations
import { highlightExtension, highlightMiniLocations } from '@strudel/codemirror'

interface EditorProps {
  code: string
  onChange: (code: string) => void
  onRegisterHighlight?: (fn: (haps: unknown[], atTime: number) => void) => void
}

export function Editor({ code, onChange, onRegisterHighlight }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          basicSetup,
          oneDark,
          javascript(),
          highlightExtension,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    onRegisterHighlight?.((haps, atTime) => {
      highlightMiniLocations(view, atTime, haps)
    })

    return () => {
      view.destroy()
      onRegisterHighlight?.((_haps, _atTime) => {})
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      })
    }
  }, [code])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}
