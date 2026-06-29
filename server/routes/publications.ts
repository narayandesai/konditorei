import { Router } from 'express'
import type { Db } from '../db.js'
import { parsePositiveInt } from '../params.js'
import type { Publication, PublicPlayerResponse } from '../../src/types.js'

function generateSlug(db: Db): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 20; i++) {
    const slug = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
    if (!db.prepare('SELECT id FROM publications WHERE slug = ?').get(slug)) return slug
  }
  throw new Error('slug generation failed after 20 attempts')
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s) || /^[a-z0-9]{3,40}$/.test(s)
}

export function songPublicationsRouter(db: Db) {
  const router = Router()

  router.get('/:songId/publications', (req, res) => {
    const songId = parsePositiveInt(req.params.songId)
    if (songId === null) { res.status(400).json({ error: 'songId must be a positive integer' }); return }
    const pubs = db
      .prepare('SELECT * FROM publications WHERE song_id = ? ORDER BY created_at DESC')
      .all(songId) as unknown as Publication[]
    res.json(pubs)
  })

  router.post('/:songId/publications', (req, res) => {
    const songId = parsePositiveInt(req.params.songId)
    if (songId === null) { res.status(400).json({ error: 'songId must be a positive integer' }); return }

    const { version_id, slug: customSlug, show_code = 1 } = req.body
    if (version_id === undefined || version_id === null) {
      res.status(400).json({ error: 'version_id is required' }); return
    }
    const vid = parsePositiveInt(String(version_id))
    if (vid === null) { res.status(400).json({ error: 'version_id must be a positive integer' }); return }
    if (show_code !== 0 && show_code !== 1) {
      res.status(400).json({ error: 'show_code must be 0 or 1' }); return
    }

    const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(songId)
    if (!song) { res.status(404).json({ error: 'song not found' }); return }

    const version = db.prepare('SELECT id FROM versions WHERE id = ? AND song_id = ?').get(vid, songId)
    if (!version) { res.status(404).json({ error: 'version not found' }); return }

    let slug: string
    if (customSlug !== undefined) {
      if (!isValidSlug(customSlug)) {
        res.status(400).json({ error: 'slug must be 3–40 characters matching [a-z0-9-]' }); return
      }
      if (db.prepare('SELECT id FROM publications WHERE slug = ?').get(customSlug)) {
        res.status(409).json({ error: 'slug already in use' }); return
      }
      slug = customSlug
    } else {
      slug = generateSlug(db)
    }

    const now = Date.now()
    const result = db
      .prepare(
        'INSERT INTO publications (song_id, version_id, slug, show_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(songId, vid, slug, show_code, now, now)

    const pub = db.prepare('SELECT * FROM publications WHERE id = ?').get(result.lastInsertRowid) as unknown as Publication
    res.status(201).json(pub)
  })

  return router
}

export function publicationsMutationRouter(db: Db) {
  const router = Router()

  router.patch('/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id)
    if (id === null) { res.status(400).json({ error: 'id must be a positive integer' }); return }

    const pub = db.prepare('SELECT * FROM publications WHERE id = ?').get(id) as unknown as Publication | undefined
    if (!pub) { res.status(404).json({ error: 'not found' }); return }

    const { version_id, slug: newSlug, show_code } = req.body

    if (newSlug !== undefined) {
      if (!isValidSlug(newSlug)) {
        res.status(400).json({ error: 'slug must be 3–40 characters matching [a-z0-9-]' }); return
      }
      if (db.prepare('SELECT id FROM publications WHERE slug = ? AND id != ?').get(newSlug, id)) {
        res.status(409).json({ error: 'slug already in use' }); return
      }
    }

    if (show_code !== undefined && show_code !== 0 && show_code !== 1) {
      res.status(400).json({ error: 'show_code must be 0 or 1' }); return
    }

    let vid: number | undefined = undefined
    if (version_id !== undefined) {
      vid = parsePositiveInt(String(version_id)) ?? undefined
      if (vid === undefined) { res.status(400).json({ error: 'version_id must be a positive integer' }); return }
      const version = db.prepare('SELECT id FROM versions WHERE id = ? AND song_id = ?').get(vid, pub.song_id)
      if (!version) { res.status(404).json({ error: 'version not found' }); return }
    }

    db.prepare(
      'UPDATE publications SET version_id = ?, slug = ?, show_code = ?, updated_at = ? WHERE id = ?'
    ).run(
      vid ?? pub.version_id,
      newSlug ?? pub.slug,
      show_code !== undefined ? show_code : pub.show_code,
      Date.now(),
      id
    )

    const updated = db.prepare('SELECT * FROM publications WHERE id = ?').get(id) as unknown as Publication
    res.json(updated)
  })

  router.delete('/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id)
    if (id === null) { res.status(400).json({ error: 'id must be a positive integer' }); return }
    if (!db.prepare('SELECT id FROM publications WHERE id = ?').get(id)) {
      res.status(404).json({ error: 'not found' }); return
    }
    db.prepare('DELETE FROM publications WHERE id = ?').run(id)
    res.status(204).send()
  })

  return router
}

export function publicPlayerRouter(db: Db) {
  const router = Router()

  router.get('/p/:slug', (req, res) => {
    if (!isValidSlug(req.params.slug)) { res.status(404).json({ error: 'not found' }); return }
    const row = db.prepare(`
      SELECT p.id, p.slug, p.show_code,
             v.code, v.number AS version_number,
             s.name AS song_name, u.name AS publisher_name
      FROM publications p
      JOIN versions v ON v.id = p.version_id
      JOIN songs s ON s.id = p.song_id
      JOIN users u ON u.id = s.user_id
      WHERE p.slug = ?
    `).get(req.params.slug) as unknown as PublicPlayerResponse | undefined
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    if (row.show_code === 0) {
      const { code: _code, ...safe } = row
      res.json(safe)
    } else {
      res.json(row)
    }
  })

  return router
}
