import { useState, useEffect, useRef } from 'react'
import { useActiveUser } from './hooks/useActiveUser.js'
import { useSongs } from './hooks/useSongs.js'
import { useVersions } from './hooks/useVersions.js'
import { usePublications } from './hooks/usePublications.js'
import { useTutorial } from './hooks/useTutorial.js'
import { PublicationsModal } from './components/PublicationsModal.js'
import { TopBar, type Visualizer } from './components/TopBar.js'
import { Editor } from './components/Editor.js'
import { VersionModal } from './components/VersionModal.js'
import { Visualizer as VisualizerPanel } from './components/Visualizer.js'
import { TutorialPanel } from './components/TutorialPanel.js'
import { TutorialPicker } from './components/TutorialPicker.js'
import * as strudel from './lib/strudel.js'
import type { StrudelError, HapsCallback } from './lib/strudel.js'

export function App() {
  const { users, activeUser, setActiveUser, createUser } = useActiveUser()
  const { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong } = useSongs(activeUser?.id)
  const { versions, latestCode, saveVersion, revertTo } = useVersions(activeSong?.id)
  const { publications, createPublication, updatePublication, deletePublication } = usePublications(activeSong?.id)
  const [showPublicationsModal, setShowPublicationsModal] = useState(false)

  const [editorCode, setEditorCode] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [strudelError, setStrudelError] = useState<string | null>(null)
  const [visualizer, setVisualizer] = useState<Visualizer>('none')
  const highlightRef = useRef<HapsCallback | null>(null)

  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null)
  const [activeTutorialTitle, setActiveTutorialTitle] = useState<string | null>(null)
  const [showTutorialPicker, setShowTutorialPicker] = useState(false)

  const tutorial = useTutorial(activeTutorialId, editorCode, isPlaying)

  function handleError(e: StrudelError) {
    setStrudelError(e.message)
  }

  function handlePublishSong(id: number) {
    const song = songs.find((s) => s.id === id)
    if (song && song.id !== activeSong?.id) setActiveSong(song)
    setShowPublicationsModal(true)
  }

  // Sync editorCode whenever the server-loaded latestCode changes (initial load or song switch).
  useEffect(() => {
    setEditorCode(latestCode)
  }, [latestCode])

  useEffect(() => {
    strudel.setHapsCallback((haps, atTime) => highlightRef.current?.(haps, atTime))
    return () => strudel.setHapsCallback(null)
  }, [])

  // Stop playback when the active song changes so we never layer two schedulers.
  useEffect(() => {
    strudel.reset()
    setIsPlaying(false)
  }, [activeSong?.id])

  // Load step code into editor when the tutorial step changes.
  useEffect(() => {
    if (tutorial.currentStep?.code != null) {
      setEditorCode(tutorial.currentStep.code)
    }
  }, [tutorial.currentIndex, tutorial.steps])

  function handleTutorialSelect(id: string, title: string) {
    strudel.stop()
    setIsPlaying(false)
    setActiveTutorialId(id)
    setActiveTutorialTitle(title)
  }

  function handleTutorialExit() {
    setActiveTutorialId(null)
    setActiveTutorialTitle(null)
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
          onPublishSong={handlePublishSong}
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
            strudel.stop()
            setIsPlaying(false)
          }}
          visualizer={visualizer}
          onVisualizerChange={setVisualizer}
          onTutorialOpen={() => setShowTutorialPicker(true)}
          activeTutorialTitle={activeTutorialTitle}
          onTutorialExit={handleTutorialExit}
        />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: activeTutorialId ? 'row' : 'column' }}>
        {activeTutorialId && activeTutorialTitle && (
          <TutorialPanel
            tutorialTitle={activeTutorialTitle}
            controls={tutorial}
            onExit={handleTutorialExit}
          />
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              code={editorCode}
              onChange={setEditorCode}
              onRegisterHighlight={(fn) => { highlightRef.current = fn ?? null }}
            />
          </div>
          <VisualizerPanel type={visualizer} isPlaying={isPlaying} />
        </div>
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
      {showPublicationsModal && activeSong && (
        <PublicationsModal
          songName={activeSong.name}
          versions={versions}
          publications={publications}
          onCreatePublication={createPublication}
          onUpdatePublication={updatePublication}
          onDeletePublication={deletePublication}
          onClose={() => setShowPublicationsModal(false)}
        />
      )}
      {showTutorialPicker && (
        <TutorialPicker
          onSelect={handleTutorialSelect}
          onClose={() => setShowTutorialPicker(false)}
        />
      )}
    </div>
  )
}
