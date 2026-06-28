// server/routes/users.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { User } from '../../src/types.js'

export function usersRouter(db: Db) {
  const router = Router()

  router.get('/', (_req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at').all() as unknown as User[]
    res.json(users)
  })

  router.post('/', (req, res) => {
    const { name } = req.body
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const created_at = Date.now()
    const result = db.prepare('INSERT INTO users (name, created_at) VALUES (?, ?)').run(name, created_at)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as unknown as User
    res.status(201).json(user)
  })

  return router
}
