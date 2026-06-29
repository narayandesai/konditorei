import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { TutorialMeta } from '../types.js'

interface TutorialPickerProps {
  onSelect: (id: string, title: string) => void
  onClose: () => void
}

export function TutorialPicker({ onSelect, onClose }: TutorialPickerProps) {
  const [tutorials, setTutorials] = useState<TutorialMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.tutorials.list()
      .then((list) => { setTutorials(list); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
        width: 520, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Choose a Tutorial</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading…</div>
          )}
          {!loading && tutorials.length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No tutorials available.</div>
          )}
          {tutorials.map((t) => (
            <div
              key={t.id}
              onClick={() => { onSelect(t.id, t.title); onClose() }}
              style={{
                padding: '12px 18px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-overlay)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: t.source === 'static' ? 'var(--bg-overlay)' : 'rgba(99,102,241,0.15)',
                  color: t.source === 'static' ? 'var(--text-muted)' : 'var(--accent)',
                  border: '1px solid var(--border)',
                }}>
                  {t.source === 'static' ? 'Static' : 'Uploaded'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.step_count} steps</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
