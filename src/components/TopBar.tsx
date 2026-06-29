import { useState, useEffect, useRef } from 'react'
import type { User, Song, Version } from '../types.js'

export type Visualizer = 'none' | 'pianoroll' | 'scope' | 'spiral'

interface TopBarProps {
  users: User[]
  activeUser: User | null
  onUserSelect: (user: User) => void
  onCreateUser: (name: string) => void
  songs: Song[]
  activeSong: Song | null
  onSongSelect: (song: Song) => void
  onCreateSong: (name: string) => void
  onRenameSong: (id: number, name: string) => void
  onDeleteSong: (id: number) => void
  onPublishSong: (id: number) => void
  latestVersion: Version | null
  onShowVersions: () => void
  onSaveVersion: () => void
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  visualizer: Visualizer
  onVisualizerChange: (v: Visualizer) => void
  onTutorialOpen: () => void
  activeTutorialTitle: string | null
  onTutorialExit: () => void
}

export function TopBar({
  users, activeUser, onUserSelect, onCreateUser,
  songs, activeSong, onSongSelect, onCreateSong, onRenameSong, onDeleteSong, onPublishSong,
  latestVersion, onShowVersions,
  onSaveVersion, isPlaying, onPlay, onStop,
  visualizer, onVisualizerChange,
  onTutorialOpen, activeTutorialTitle, onTutorialExit,
}: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [songMenuOpen, setSongMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const songMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (songMenuRef.current && !songMenuRef.current.contains(e.target as Node)) setSongMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const ts = latestVersion
    ? new Date(latestVersion.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: 10, position: 'relative' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em', flexShrink: 0 }}>KONDITOREI</span>
      <span style={{ color: 'var(--border)' }}>|</span>

      {/* User switcher */}
      <div ref={userMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4 }}
        >
          {activeUser?.name ?? 'no user'} ▾
        </button>
        {userMenuOpen && (
          <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 160, zIndex: 100 }}>
            {users.map((u) => (
              <div key={u.id}
                onClick={() => { onUserSelect(u); setUserMenuOpen(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', color: u.id === activeUser?.id ? 'var(--accent)' : 'var(--text-primary)' }}
              >{u.name}</div>
            ))}
            <div
              onClick={() => { const name = prompt('New user name:'); if (name) { onCreateUser(name); setUserMenuOpen(false) } }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--green)', borderTop: '1px solid var(--border)' }}
            >+ New User</div>
          </div>
        )}
      </div>

      <span style={{ color: 'var(--border)' }}>|</span>

      {/* Song selector */}
      <div ref={songMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setSongMenuOpen((o) => !o)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, minWidth: 140 }}
        >
          {activeSong?.name ?? 'no songs'} ▾
        </button>
        {songMenuOpen && (
          <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 200, zIndex: 100 }}>
            {songs.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div onClick={() => { onSongSelect(s); setSongMenuOpen(false) }}
                  style={{ flex: 1, padding: '8px 12px', cursor: 'pointer', color: s.id === activeSong?.id ? 'var(--accent)' : 'var(--text-primary)' }}
                >{s.name}{s.publication_count ? <span style={{ color: 'var(--green)', marginLeft: 6, fontSize: 10 }}>·</span> : null}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); const name = prompt('Rename song:', s.name); if (name && name !== s.name) onRenameSong(s.id, name) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 4px' }}
                  title="Rename"
                >✎</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onPublishSong(s.id); setSongMenuOpen(false) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 4px' }}
                  title="Publish"
                >↑</button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${s.name}"?`)) { onDeleteSong(s.id); setSongMenuOpen(false) } }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 8px' }}
                  title="Delete"
                >✕</button>
              </div>
            ))}
            <div
              onClick={() => { const name = prompt('New song name:'); if (name) { onCreateSong(name); setSongMenuOpen(false) } }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--green)', borderTop: '1px solid var(--border)' }}
            >+ New Song</div>
          </div>
        )}
      </div>

      {/* Version badge */}
      {latestVersion && (
        <button
          onClick={onShowVersions}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, padding: '3px 6px' }}
        >
          v{latestVersion.number} · {ts}
        </button>
      )}

      {/* Right side controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {activeTutorialTitle ? (
          <button
            onClick={onTutorialExit}
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 4, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title="Exit tutorial"
          >
            {activeTutorialTitle.length > 22 ? activeTutorialTitle.slice(0, 20) + '…' : activeTutorialTitle} ×
          </button>
        ) : (
          <button
            onClick={onTutorialOpen}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 4, fontSize: 12 }}
          >
            Tutorial
          </button>
        )}
        <select
          value={visualizer}
          onChange={(e) => onVisualizerChange(e.target.value as Visualizer)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 4, fontSize: 12 }}
        >
          <option value="none">No Visualizer</option>
          <option value="pianoroll">Piano Roll</option>
          <option value="scope">Scope</option>
          <option value="spiral">Spiral</option>
        </select>

        <button
          onClick={onSaveVersion}
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 4 }}
        >
          Save Version
        </button>

        {!isPlaying ? (
          <button onClick={onPlay} style={{ background: 'var(--green)', border: 'none', color: '#fff', padding: '4px 14px', borderRadius: 4 }}>
            ▶ Play
          </button>
        ) : (
          <button onClick={onStop} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '4px 14px', borderRadius: 4 }}>
            ■ Stop
          </button>
        )}
      </div>
    </div>
  )
}
