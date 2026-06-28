import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import type { Version, DiffLine } from '../types.js'

interface VersionModalProps {
  songId: number
  versions: Version[]
  onRevert: (v: number) => void
  onClose: () => void
}

export function VersionModal({ songId, versions, onRevert, onClose }: VersionModalProps) {
  const [selectedV, setSelectedV] = useState<number>(versions[versions.length - 1]?.number ?? 1)
  const [diff, setDiff] = useState<DiffLine[]>([])

  // If a new version is saved while the modal is open and selectedV was the latest,
  // follow the selection to the new latest so the revert button doesn't appear erroneously.
  const prevLatestRef = useRef(versions[versions.length - 1]?.number)
  useEffect(() => {
    const newLatest = versions[versions.length - 1]?.number
    if (newLatest === undefined) return
    if (selectedV === prevLatestRef.current && selectedV !== newLatest) {
      setSelectedV(newLatest)
    }
    prevLatestRef.current = newLatest
  }, [versions])

  useEffect(() => {
    if (!selectedV) return
    setDiff([])
    api.versions.diff(songId, selectedV).then(setDiff).catch(() => setDiff([]))
  }, [songId, selectedV])

  const selectedVersion = versions.find((v) => v.number === selectedV)
  const isLatest = selectedVersion?.number === versions[versions.length - 1]?.number

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 160, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
            {[...versions].reverse().map((v) => (
              <div
                key={v.number}
                onClick={() => setSelectedV(v.number)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderLeft: `2px solid ${v.number === selectedV ? 'var(--accent)' : 'transparent'}`,
                  background: v.number === selectedV ? 'var(--bg-overlay)' : 'transparent',
                }}
              >
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                  v{v.number}
                  {v.number === versions[versions.length - 1]?.number && (
                    <span style={{ color: 'var(--green)', fontSize: 11, marginLeft: 6 }}>current</span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-base)' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11 }}>
              {selectedV > 1 ? `v${selectedV - 1} → v${selectedV}` : `v${selectedV} (initial)`}
            </div>
            {diff.map((line, i) => (
              <div
                key={i}
                style={{
                  padding: '0 4px',
                  borderRadius: 2,
                  background: line.type === 'added' ? '#1a3a2a' : line.type === 'removed' ? '#3d1a1a' : 'transparent',
                  color: line.type === 'added' ? 'var(--green)' : line.type === 'removed' ? 'var(--red)' : 'var(--text-secondary)',
                  whiteSpace: 'pre',
                }}
              >
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          {!isLatest && selectedVersion && (
            <button
              onClick={() => { onRevert(selectedVersion.number); onClose() }}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 14px', borderRadius: 4 }}
            >
              Revert to v{selectedVersion.number}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
