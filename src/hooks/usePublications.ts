import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Publication, PublicationPatch } from '../types.js'

export function usePublications(songId: number | undefined) {
  const [publications, setPublications] = useState<Publication[]>([])

  useEffect(() => {
    if (!songId) { setPublications([]); return }
    api.publications.list(songId).then(setPublications).catch(() => setPublications([]))
  }, [songId])

  async function createPublication(versionId: number): Promise<Publication> {
    const pub = await api.publications.create(songId!, { version_id: versionId })
    setPublications((prev) => [pub, ...prev])
    return pub
  }

  async function updatePublication(id: number, patch: PublicationPatch): Promise<Publication> {
    const updated = await api.publications.update(id, patch)
    setPublications((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }

  async function deletePublication(id: number): Promise<void> {
    await api.publications.delete(id)
    setPublications((prev) => prev.filter((p) => p.id !== id))
  }

  return { publications, createPublication, updatePublication, deletePublication }
}
