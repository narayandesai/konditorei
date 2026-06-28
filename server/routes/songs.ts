// server/routes/songs.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { Song } from '../../src/types.js'

export function songsRouter(db: Db) {
  const router = Router()

  router.get('/', (req, res) => {
    const { userId } = req.query
    if (!userId) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    const songs = db
      .prepare('SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC')
      .all(Number(userId)) as Song[]
    res.json(songs)
  })

  router.post('/', (req, res) => {
    const { userId, name } = req.body
    if (!userId || !name) {
      res.status(400).json({ error: 'userId and name are required' })
      return
    }
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO songs (user_id, name, created_at) VALUES (?, ?, ?)')
      .run(userId, name, created_at)
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(result.lastInsertRowid) as Song
    res.status(201).json(song)
  })

  router.patch('/:id', (req, res) => {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    db.prepare('UPDATE songs SET name = ? WHERE id = ?').run(name, req.params.id)
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id) as Song | undefined
    if (!song) { res.status(404).json({ error: 'not found' }); return }
    res.json(song)
  })

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id)
    res.status(204).send()
  })

  return router
}
