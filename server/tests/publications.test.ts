// server/tests/publications.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { createDb, type Db } from '../db.js'

function seed(db: Db) {
  const userId = Number(
    db.prepare('INSERT INTO users (name, created_at) VALUES (?, ?)').run('alice', Date.now()).lastInsertRowid
  )
  const songId = Number(
    db.prepare('INSERT INTO songs (user_id, name, created_at) VALUES (?, ?, ?)').run(userId, 'test song', Date.now()).lastInsertRowid
  )
  const versionId = Number(
    db.prepare('INSERT INTO versions (song_id, number, code, created_at) VALUES (?, ?, ?, ?)').run(songId, 1, 'note("c4")', Date.now()).lastInsertRowid
  )
  return { userId, songId, versionId }
}

describe('publications', () => {
  let app: ReturnType<typeof createApp>
  let songId: number
  let versionId: number

  beforeEach(() => {
    const db = createDb(':memory:')
    app = createApp(db)
    ;({ songId, versionId } = seed(db))
  })

  it('GET /api/songs/:songId/publications returns empty array initially', async () => {
    const res = await request(app).get(`/api/songs/${songId}/publications`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/songs/:songId/publications creates a publication with auto slug', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ song_id: songId, version_id: versionId, show_code: 1 })
    expect(res.body.slug).toMatch(/^[a-z0-9]{6}$/)
  })

  it('POST /api/songs/:songId/publications accepts a custom slug', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, slug: 'my-track' })
    expect(res.status).toBe(201)
    expect(res.body.slug).toBe('my-track')
  })

  it('POST /api/songs/:songId/publications returns 409 for duplicate slug', async () => {
    await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, slug: 'taken' })
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, slug: 'taken' })
    expect(res.status).toBe(409)
  })

  it('POST /api/songs/:songId/publications returns 400 for invalid slug', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, slug: 'AB' })
    expect(res.status).toBe(400)
  })

  it('POST /api/songs/:songId/publications respects show_code: 0', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, show_code: 0 })
    expect(res.status).toBe(201)
    expect(res.body.show_code).toBe(0)
  })

  it('POST /api/songs/:songId/publications returns 400 when version_id missing', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST /api/songs/:songId/publications returns 404 for version not in this song', async () => {
    const res = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: 9999 })
    expect(res.status).toBe(404)
  })

  it('a song can have multiple publications', async () => {
    await request(app).post(`/api/songs/${songId}/publications`).send({ version_id: versionId })
    await request(app).post(`/api/songs/${songId}/publications`).send({ version_id: versionId })
    const res = await request(app).get(`/api/songs/${songId}/publications`)
    expect(res.body).toHaveLength(2)
  })

  it('PATCH /api/publications/:id updates show_code', async () => {
    const create = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId })
    const res = await request(app)
      .patch(`/api/publications/${create.body.id}`)
      .send({ show_code: 0 })
    expect(res.status).toBe(200)
    expect(res.body.show_code).toBe(0)
  })

  it('PATCH /api/publications/:id updates slug', async () => {
    const create = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId })
    const res = await request(app)
      .patch(`/api/publications/${create.body.id}`)
      .send({ slug: 'new-slug' })
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe('new-slug')
  })

  it('PATCH /api/publications/:id returns 409 on slug conflict', async () => {
    const a = await request(app).post(`/api/songs/${songId}/publications`).send({ version_id: versionId, slug: 'slug-a' })
    await request(app).post(`/api/songs/${songId}/publications`).send({ version_id: versionId, slug: 'slug-b' })
    const res = await request(app).patch(`/api/publications/${a.body.id}`).send({ slug: 'slug-b' })
    expect(res.status).toBe(409)
  })

  it('PATCH /api/publications/:id returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/publications/9999').send({ show_code: 0 })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/publications/:id removes the publication', async () => {
    const create = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId })
    const del = await request(app).delete(`/api/publications/${create.body.id}`)
    expect(del.status).toBe(204)
    const list = await request(app).get(`/api/songs/${songId}/publications`)
    expect(list.body).toHaveLength(0)
  })

  it('DELETE /api/publications/:id returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/publications/9999')
    expect(res.status).toBe(404)
  })

  it('GET /api/p/:slug returns player data', async () => {
    const create = await request(app)
      .post(`/api/songs/${songId}/publications`)
      .send({ version_id: versionId, slug: 'player-test' })
    const res = await request(app).get('/api/p/player-test')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      slug: 'player-test',
      song_name: 'test song',
      publisher_name: 'alice',
      version_number: 1,
      code: 'note("c4")',
      show_code: 1,
    })
  })

  it('GET /api/p/:slug returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/p/no-such-slug')
    expect(res.status).toBe(404)
  })
})
