// server/tests/songs.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { createDb } from '../db.js'
import type { Db } from '../db.js'

function seedUser(db: Db) {
  return db.prepare('INSERT INTO users (name, created_at) VALUES (?, ?)').run('narayan', Date.now())
}

describe('songs', () => {
  let app: ReturnType<typeof createApp>
  let userId: number

  beforeEach(() => {
    const db = createDb(':memory:')
    app = createApp(db)
    userId = Number(seedUser(db).lastInsertRowid)
  })

  it('GET /api/songs?userId= returns empty array initially', async () => {
    const res = await request(app).get(`/api/songs?userId=${userId}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/songs creates a song', async () => {
    const res = await request(app).post('/api/songs').send({ userId, name: 'acid groove' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 1, user_id: userId, name: 'acid groove' })
  })

  it('PATCH /api/songs/:id renames a song', async () => {
    const create = await request(app).post('/api/songs').send({ userId, name: 'acid groove' })
    const res = await request(app).patch(`/api/songs/${create.body.id}`).send({ name: 'new name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('new name')
  })

  it('DELETE /api/songs/:id deletes a song', async () => {
    const create = await request(app).post('/api/songs').send({ userId, name: 'acid groove' })
    const del = await request(app).delete(`/api/songs/${create.body.id}`)
    expect(del.status).toBe(204)
    const list = await request(app).get(`/api/songs?userId=${userId}`)
    expect(list.body).toHaveLength(0)
  })

  it('GET /api/songs?userId= returns 400 when userId missing', async () => {
    const res = await request(app).get('/api/songs')
    expect(res.status).toBe(400)
  })
})
