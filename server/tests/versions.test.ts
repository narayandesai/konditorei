// server/tests/versions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { createDb, type Db } from '../db.js'

function seed(db: Db) {
  const userId = Number(db.prepare('INSERT INTO users (name, created_at) VALUES (?, ?)').run('narayan', Date.now()).lastInsertRowid)
  const songId = Number(db.prepare('INSERT INTO songs (user_id, name, created_at) VALUES (?, ?, ?)').run(userId, 'test song', Date.now()).lastInsertRowid)
  return { userId, songId }
}

describe('versions', () => {
  let app: ReturnType<typeof createApp>
  let songId: number

  beforeEach(() => {
    const db = createDb(':memory:')
    app = createApp(db)
    ;({ songId } = seed(db))
  })

  it('GET /api/songs/:id/versions returns empty array initially', async () => {
    const res = await request(app).get(`/api/songs/${songId}/versions`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/songs/:id/versions saves a version', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/versions`)
      .send({ code: 'note("c3")' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ number: 1, song_id: songId, code: 'note("c3")' })
  })

  it('version numbers increment', async () => {
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'v1' })
    const res = await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'v2' })
    expect(res.body.number).toBe(2)
  })

  it('GET /api/songs/:id/versions/:v returns a single version with code', async () => {
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'note("c3")' })
    const res = await request(app).get(`/api/songs/${songId}/versions/1`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ number: 1, song_id: songId, code: 'note("c3")' })
  })

  it('GET /api/songs/:id/versions/:v returns 404 for unknown version', async () => {
    const res = await request(app).get(`/api/songs/${songId}/versions/99`)
    expect(res.status).toBe(404)
  })

  it('GET /api/songs/:id/versions/:v/diff returns diff', async () => {
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'note("c3")' })
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'note("c3")\n.fast(2)' })
    const res = await request(app).get(`/api/songs/${songId}/versions/2/diff`)
    expect(res.status).toBe(200)
    expect(res.body).toContainEqual({ type: 'unchanged', text: 'note("c3")' })
    expect(res.body).toContainEqual({ type: 'added', text: '.fast(2)' })
  })

  it('POST /api/songs/:id/revert/:v creates a new version with old code', async () => {
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'original' })
    await request(app).post(`/api/songs/${songId}/versions`).send({ code: 'changed' })
    const res = await request(app).post(`/api/songs/${songId}/revert/1`)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ number: 3, code: 'original' })
  })
})
