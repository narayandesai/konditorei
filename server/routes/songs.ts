// server/routes/songs.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { Song } from '../../src/types.js'

export function songsRouter(db: Db) {
  const router = Router()

  router.get('/', (req, res) => {
    const { userId } = req.query
    if (!userId || isNaN(Number(userId))) {
      res.status(400).json({ error: 'userId must be a number' })
      return
    }
    const songs = db
      .prepare(
        `SELECT s.*, COUNT(p.id) AS publication_count
         FROM songs s
         LEFT JOIN publications p ON p.song_id = s.id
         WHERE s.user_id = ?
         GROUP BY s.id
         ORDER BY s.created_at DESC`
      )
      .all(Number(userId)) as unknown as Song[]
    res.json(songs)
  })

  router.post('/', (req, res) => {
    const { userId, name } = req.body
    if (!userId || !name) {
      res.status(400).json({ error: 'userId and name are required' })
      return
    }
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
    if (!userExists) { res.status(404).json({ error: 'user not found' }); return }
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO songs (user_id, name, created_at) VALUES (?, ?, ?)')
      .run(userId, name, created_at)
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(result.lastInsertRowid) as unknown as Song
    res.status(201).json(song)
  })

  router.patch('/:id', (req, res) => {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id) as unknown as Song | undefined
    if (!song) { res.status(404).json({ error: 'not found' }); return }
    db.prepare('UPDATE songs SET name = ? WHERE id = ?').run(name, req.params.id)
    res.json({ ...song, name })
  })

  router.delete('/:id', (req, res) => {
    const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(req.params.id)
    if (!song) { res.status(404).json({ error: 'not found' }); return }
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id)
    res.status(204).send()
  })

  return router
}
