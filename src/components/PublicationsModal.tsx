import { useEffect, useState } from 'react'
import type { Publication, PublicationPatch, Version } from '../types.js'

interface PublicationsModalProps {
  songName: string
  versions: Version[]
  publications: Publication[]
  onCreatePublication: (versionId: number) => Promise<Publication>
  onUpdatePublication: (id: number, patch: PublicationPatch) => Promise<Publication>
  onDeletePublication: (id: number) => Promise<void>
  onClose: () => void
}

export function PublicationsModal({
  songName, versions, publications,
  onCreatePublication, onUpdatePublication, onDeletePublication, onClose,
}: PublicationsModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(publications[0]?.id ?? null)
  const [slugInput, setSlugInput] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)

  const selected = publications.find((p) => p.id === selectedId) ?? null

  useEffect(() => {
    setSlugInput(selected?.slug ?? '')
    setSlugError(null)
  }, [selected?.id])

  useEffect(() => {
    if (selectedId === null && publications.length > 0) {
      setSelectedId(publications[0].id)
    }
  }, [publications, selectedId])

  const latestVersion = versions[versions.length - 1]
  const origin = window.location.origin

  async function handleNew() {
    if (!latestVersion) return
    try {
      const pub = await onCreatePublication(latestVersion.id)
      setSelectedId(pub.id)
    } catch {
      setSlugError('Failed to create publication')
    }
  }

  async function handleSlugBlur() {
    if (!selected || slugInput === selected.slug) return
    try {
      await onUpdatePublication(selected.id, { slug: slugInput })
      setSlugError(null)
    } catch {
      setSlugError('Slug unavailable or invalid')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, width: 640, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Publications — {songName}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: publication list */}
          <div style={{ width: 210, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {publications.map((p) => {
                const vNum = versions.find((v) => v.id === p.version_id)?.number
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderLeft: `2px solid ${p.id === selectedId ? 'var(--accent)' : 'transparent'}`,
                      background: p.id === selectedId ? 'var(--bg-overlay)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      /p/{p.slug}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {vNum !== undefined ? `v${vNum}` : '?'} · {p.show_code ? 'code on' : 'code off'}
                    </div>
                  </div>
                )
              })}
              {publications.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No publications yet.</div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', padding: 10 }}>
              <button
                onClick={handleNew}
                disabled={!latestVersion}
                style={{ width: '100%', background: 'none', border: '1px solid var(--border)', color: 'var(--green)', padding: '6px 0', borderRadius: 4, fontSize: 12, cursor: latestVersion ? 'pointer' : 'not-allowed' }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Right: edit form */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {selected ? (
              <>
                {/* URL */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>URL</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-overlay)', padding: '6px 8px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {origin}/p/{selected.slug}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${origin}/p/${selected.slug}`)}
                      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 4, fontSize: 12, flexShrink: 0 }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Version picker */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Version</label>
                  <select
                    value={selected.version_id}
                    onChange={(e) => onUpdatePublication(selected.id, { version_id: Number(e.target.value) })}
                    style={{ width: '100%', background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 4, fontSize: 12 }}
                  >
                    {[...versions].reverse().map((v) => (
                      <option key={v.id} value={v.id}>v{v.number}</option>
                    ))}
                  </select>
                </div>

                {/* Slug */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Slug</label>
                  <input
                    value={slugInput}
                    onChange={(e) => { setSlugInput(e.target.value); setSlugError(null) }}
                    onBlur={handleSlugBlur}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-overlay)',
                      border: `1px solid ${slugError ? 'var(--red)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      boxSizing: 'border-box',
                    }}
                  />
                  {slugError && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{slugError}</div>}
                </div>

                {/* Show code toggle */}
                <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="pub-show-code"
                    checked={selected.show_code === 1}
                    onChange={(e) => onUpdatePublication(selected.id, { show_code: e.target.checked ? 1 : 0 })}
                  />
                  <label htmlFor="pub-show-code" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Show code to visitors
                  </label>
                </div>

                {/* Unpublish */}
                <button
                  onClick={async () => {
                    if (!confirm('Remove this publication? The URL will stop working immediately.')) return
                    await onDeletePublication(selected.id)
                    setSelectedId(null)
                  }}
                  style={{ background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', padding: '5px 14px', borderRadius: 4, fontSize: 12 }}
                >
                  Unpublish
                </button>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
                Select a publication to edit, or click + New.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
