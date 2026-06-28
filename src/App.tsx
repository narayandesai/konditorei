import { useState } from 'react'
import { useActiveUser } from './hooks/useActiveUser.js'
import { useSongs } from './hooks/useSongs.js'
import { useVersions } from './hooks/useVersions.js'
import { TopBar, type Visualizer } from './components/TopBar.js'
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
        {/* Editor — Task 16 */}
        <div style={{ flex: 1, padding: 16, color: 'var(--text-secondary)' }}>Editor placeholder (code: {latestCode.length} chars)</div>
        {/* Visualizer — Task 18 */}
      </div>
      {strudelError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: 'var(--red)', color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13 }}>
          {strudelError}
          <button onClick={() => setStrudelError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#fff' }}>×</button>
        </div>
      )}
    </div>
  )
}
