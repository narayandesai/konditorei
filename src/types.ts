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
  publication_count?: number
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

export interface Publication {
  id: number
  song_id: number
  version_id: number
  slug: string
  show_code: 0 | 1
  created_at: number
  updated_at: number
}

export interface PublicationPatch {
  version_id?: number
  slug?: string
  show_code?: 0 | 1
}

export interface PublicPlayerResponse {
  id: number
  slug: string
  song_name: string
  publisher_name: string
  version_number: number
  code: string
  show_code: 0 | 1
}
