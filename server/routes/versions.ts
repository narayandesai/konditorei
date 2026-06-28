// server/routes/versions.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { Version, VersionWithCode } from '../../src/types.js'
import { diffLines } from '../diff.js'

function parsePositiveInt(s: string): number | null {
  const n = Number(s)
  return Number.isInteger(n) && n >= 1 ? n : null
}

export function versionsRouter(db: Db) {
  const router = Router()

  router.get('/:songId/versions', (req, res) => {
    const versions = db
      .prepare('SELECT id, song_id, number, created_at FROM versions WHERE song_id = ? ORDER BY number')
      .all(req.params.songId) as unknown as Version[]
    res.json(versions)
  })

  router.get('/:songId/versions/:v', (req, res) => {
    const v = parsePositiveInt(req.params.v)
    if (v === null) { res.status(400).json({ error: 'version must be a positive integer' }); return }
    const version = db
      .prepare('SELECT * FROM versions WHERE song_id = ? AND number = ?')
      .get(req.params.songId, v) as unknown as VersionWithCode | undefined
    if (!version) { res.status(404).json({ error: 'not found' }); return }
    res.json(version)
  })

  router.post('/:songId/versions', (req, res) => {
    const { code } = req.body
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code is required' })
      return
    }
    const songExists = db.prepare('SELECT id FROM songs WHERE id = ?').get(req.params.songId)
    if (!songExists) { res.status(404).json({ error: 'song not found' }); return }
    const last = db
      .prepare('SELECT number FROM versions WHERE song_id = ? ORDER BY number DESC LIMIT 1')
      .get(req.params.songId) as unknown as { number: number } | undefined
    const number = (last?.number ?? 0) + 1
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO versions (song_id, number, code, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.songId, number, code, created_at)
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(result.lastInsertRowid) as unknown as VersionWithCode
    res.status(201).json(version)
  })

  router.get('/:songId/versions/:v/diff', (req, res) => {
    const v = parsePositiveInt(req.params.v)
    if (v === null) { res.status(400).json({ error: 'version must be a positive integer' }); return }
    const rows = db
      .prepare('SELECT * FROM versions WHERE song_id = ? AND number IN (?, ?) ORDER BY number')
      .all(req.params.songId, v - 1, v) as unknown as VersionWithCode[]

    // rows[0] is v-1 (or v if v=1), rows[1] is v (or undefined)
    let previous: VersionWithCode | undefined
    let current: VersionWithCode | undefined
    if (rows.length === 2) {
      previous = rows[0]
      current = rows[1]
    } else if (rows.length === 1 && rows[0].number === v) {
      current = rows[0]
    }

    if (!current) { res.status(404).json({ error: 'version not found' }); return }

    const oldCode = previous?.code ?? ''
    res.json(diffLines(oldCode, current.code))
  })

  router.post('/:songId/revert/:v', (req, res) => {
    const v = parsePositiveInt(req.params.v)
    if (v === null) { res.status(400).json({ error: 'version must be a positive integer' }); return }
    const target = db
      .prepare('SELECT * FROM versions WHERE song_id = ? AND number = ?')
      .get(req.params.songId, v) as unknown as VersionWithCode | undefined
    if (!target) { res.status(404).json({ error: 'version not found' }); return }

    const last = db
      .prepare('SELECT number FROM versions WHERE song_id = ? ORDER BY number DESC LIMIT 1')
      .get(req.params.songId) as unknown as { number: number } | undefined
    const number = (last?.number ?? 0) + 1
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO versions (song_id, number, code, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.songId, number, target.code, created_at)
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(result.lastInsertRowid) as unknown as VersionWithCode
    res.status(201).json(version)
  })

  return router
}
