export interface User {
  id: number
  name: string
  created_at: number
}

export interface Song {
  id: number
  user_id: number
  name: string
  created_at: number
}

export interface Version {
  id: number
  song_id: number
  number: number
  created_at: number
}

export interface VersionWithCode extends Version {
  code: string
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}
