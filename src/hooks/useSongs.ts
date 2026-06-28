import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Song } from '../types.js'

export function useSongs(userId: number | undefined) {
  const [songs, setSongs] = useState<Song[]>([])
  const [activeSong, setActiveSong] = useState<Song | null>(null)

  useEffect(() => {
    if (!userId) return
    api.songs.list(userId).then((all) => {
      setSongs(all)
      setActiveSong(all[0] ?? null)
    }).catch(() => { setSongs([]); setActiveSong(null) })
  }, [userId])

  // Keep activeSong in sync when it's no longer present in the songs list
  // (e.g. after a delete resolves). Avoids calling setActiveSong as a side
  // effect inside a setSongs updater, which is unsafe in Strict Mode.
  useEffect(() => {
    if (activeSong && !songs.find((s) => s.id === activeSong.id)) {
      setActiveSong(songs[0] ?? null)
    }
  }, [songs, activeSong])

  async function createSong(name: string): Promise<Song> {
    if (!userId) throw new Error('no active user')
    const song = await api.songs.create(userId, name)
    setSongs((prev) => [song, ...prev])
    setActiveSong(song)
    return song
  }

  async function renameSong(id: number, name: string) {
    const updated = await api.songs.rename(id, name)
    setSongs((prev) => prev.map((s) => (s.id === id ? updated : s)))
    if (activeSong?.id === id) setActiveSong(updated)
  }

  async function deleteSong(id: number) {
    await api.songs.delete(id)
    setSongs((prev) => prev.filter((s) => s.id !== id))
  }

  return { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong }
}
