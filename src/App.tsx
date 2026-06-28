import { useState, useEffect } from 'react'
import { useActiveUser } from './hooks/useActiveUser.js'
import { useSongs } from './hooks/useSongs.js'
import { useVersions } from './hooks/useVersions.js'
import { TopBar, type Visualizer } from './components/TopBar.js'
import { Editor } from './components/Editor.js'
import { VersionModal } from './components/VersionModal.js'
import { Visualizer as VisualizerPanel } from './components/Visualizer.js'
import * as strudel from './lib/strudel.js'
import type { StrudelError } from './lib/strudel.js'

export function App() {
  const { users, activeUser, setActiveUser, createUser } = useActiveUser()
  const { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong } = useSongs(activeUser?.id)
  const { versions, latestCode, saveVersion, revertTo } = useVersions(activeSong?.id)

  const [editorCode, setEditorCode] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [strudelError, setStrudelError] = useState<string | null>(null)
  const [visualizer, setVisualizer] = useState<Visualizer>('none')

  function handleError(e: StrudelError) {
    setStrudelError(e.message)
  }

  // Sync editorCode whenever the server-loaded latestCode changes (initial load or song switch).
  useEffect(() => {
    setEditorCode(latestCode)
  }, [latestCode])

  // Stop playback when the active song changes so we never layer two schedulers.
  useEffect(() => {
    strudel.reset()
    setIsPlaying(false)
  }, [activeSong?.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 44, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <TopBar
          users={users}
          activeUser={activeUser}
          onUserSelect={setActiveUser}
          onCreateUser={createUser}
          songs={songs}
          activeSong={activeSong}
          onSongSelect={setActiveSong}
          onCreateSong={createSong}
          onRenameSong={renameSong}
          onDeleteSong={deleteSong}
          latestVersion={versions[versions.length - 1] ?? null}
          onShowVersions={() => setShowVersionModal(true)}
          onSaveVersion={() => saveVersion(editorCode)}
          isPlaying={isPlaying}
          onPlay={() => {
            strudel.evaluate(editorCode, handleError)
              .then(() => { strudel.start(handleError); setIsPlaying(true) })
              .catch((e: unknown) => handleError({ message: String(e) }))
          }}
          onStop={() => {
            strudel.stop(handleError)
            setIsPlaying(false)
          }}
          visualizer={visualizer}
          onVisualizerChange={setVisualizer}
        />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor code={editorCode} onChange={setEditorCode} />
        </div>
        <VisualizerPanel type={visualizer} isPlaying={isPlaying} />
      </div>
      {strudelError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: 'var(--red)', color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13 }}>
          {strudelError}
          <button onClick={() => setStrudelError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#fff' }}>×</button>
        </div>
      )}
      {showVersionModal && activeSong && (
        <VersionModal
          songId={activeSong.id}
          versions={versions}
          onRevert={(v) => revertTo(v)}
          onClose={() => setShowVersionModal(false)}
        />
      )}
    </div>
  )
}
