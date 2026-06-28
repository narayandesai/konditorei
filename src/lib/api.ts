import type { User, Song, Version, VersionWithCode, DiffLine } from '../types.js'

const base = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  users: {
    list: () => req<User[]>('GET', '/users'),
    create: (name: string) => req<User>('POST', '/users', { name }),
  },
  songs: {
    list: (userId: number) => req<Song[]>('GET', `/songs?userId=${userId}`),
    create: (userId: number, name: string) => req<Song>('POST', '/songs', { userId, name }),
    rename: (id: number, name: string) => req<Song>('PATCH', `/songs/${id}`, { name }),
    delete: (id: number) => req<void>('DELETE', `/songs/${id}`),
  },
  versions: {
    list: (songId: number) => req<Version[]>('GET', `/songs/${songId}/versions`),
    get: (songId: number, v: number) => req<VersionWithCode>('GET', `/songs/${songId}/versions/${v}`),
    save: (songId: number, code: string) => req<VersionWithCode>('POST', `/songs/${songId}/versions`, { code }),
    diff: (songId: number, v: number) => req<DiffLine[]>('GET', `/songs/${songId}/versions/${v}/diff`),
    revert: (songId: number, v: number) => req<VersionWithCode>('POST', `/songs/${songId}/revert/${v}`),
  },
}
