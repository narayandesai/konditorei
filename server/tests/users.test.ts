// server/tests/users.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { createDb } from '../db.js'

describe('users', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp(createDb(':memory:'))
  })

  it('GET /api/users returns empty array initially', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/users creates a user', async () => {
    const res = await request(app).post('/api/users').send({ name: 'narayan' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 1, name: 'narayan' })
    expect(typeof res.body.created_at).toBe('number')
  })

  it('GET /api/users returns created users', async () => {
    await request(app).post('/api/users').send({ name: 'narayan' })
    await request(app).post('/api/users').send({ name: 'alice' })
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].name).toBe('narayan')
    expect(res.body[1].name).toBe('alice')
  })

  it('POST /api/users returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/users').send({})
    expect(res.status).toBe(400)
  })
})
