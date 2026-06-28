import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Version, VersionWithCode } from '../types.js'

export function useVersions(songId: number | undefined) {
  const [versions, setVersions] = useState<Version[]>([])
  const [latestCode, setLatestCode] = useState<string>('')

  useEffect(() => {
    if (!songId) { setVersions([]); setLatestCode(''); return }
    let cancelled = false
    api.versions.list(songId).then(async (all) => {
      if (cancelled) return
      setVersions(all)
      if (all.length === 0) { setLatestCode(''); return }
      const latest = all[all.length - 1]
      const withCode = await api.versions.get(songId, latest.number)
      if (!cancelled) setLatestCode(withCode.code)
    }).catch(() => { if (!cancelled) { setVersions([]); setLatestCode('') } })
    return () => { cancelled = true }
  }, [songId])

  async function saveVersion(code: string): Promise<VersionWithCode> {
    if (!songId) throw new Error('no active song')
    const version = await api.versions.save(songId, code)
    setVersions((prev) => [...prev, version])
    setLatestCode(version.code)
    return version
  }

  async function revertTo(v: number): Promise<VersionWithCode> {
    if (!songId) throw new Error('no active song')
    const version = await api.versions.revert(songId, v)
    setVersions((prev) => [...prev, version])
    setLatestCode(version.code)
    return version
  }

  return { versions, latestCode, saveVersion, revertTo }
}
