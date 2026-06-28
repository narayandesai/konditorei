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
    const remaining = songs.filter((s) => s.id !== id)
    setSongs(remaining)
    if (activeSong?.id === id) setActiveSong(remaining[0] ?? null)
  }

  return { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong }
}
