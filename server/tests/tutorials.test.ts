import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createApp } from '../app.js'
import { createDb, type Db } from '../db.js'

const VALID_TUTORIAL = {
  id: 'test-tutorial',
  title: 'Test Tutorial',
  description: 'A tutorial for testing',
  steps: [
    {
      title: 'Step 1',
      content: '# Hello\nWorld',
      code: 'note("c4")',
      fitness: [{ type: 'play' }],
    },
    {
      title: 'Step 2',
      content: 'Type **e4**',
      fitness: [
        { type: 'code_contains', value: 'e4' },
        { type: 'play' },
      ],
    },
    {
      title: 'Quiz step',
      content: 'Answer this.',
      fitness: [
        { type: 'quiz', question: 'Best note?', options: ['c4', 'e4', 'g4'], answer: 1 },
      ],
    },
  ],
}

function makeTutorialsDir(tutorials: typeof VALID_TUTORIAL[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'konditorei-test-'))
  for (const t of tutorials) {
    writeFileSync(join(dir, `${t.id}.json`), JSON.stringify(t))
  }
  return dir
}

describe('tutorials', () => {
  let app: ReturnType<typeof createApp>
  let db: Db
  let tutorialsDir: string

  beforeEach(() => {
    tutorialsDir = makeTutorialsDir()
    db = createDb(':memory:')
    app = createApp(db, tutorialsDir)
  })

  describe('GET /api/tutorials', () => {
    it('returns empty array when no tutorials exist', async () => {
      const res = await request(app).get('/api/tutorials')
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns static tutorials from the directory', async () => {
      const dir = makeTutorialsDir([VALID_TUTORIAL])
      const a = createApp(createDb(':memory:'), dir)
      const res = await request(a).get('/api/tutorials')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0]).toMatchObject({
        id: 'test-tutorial',
        title: 'Test Tutorial',
        description: 'A tutorial for testing',
        source: 'static',
        step_count: 3,
      })
    })

    it('returns uploaded tutorials from the DB', async () => {
      await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      const res = await request(app).get('/api/tutorials')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0]).toMatchObject({
        id: 'test-tutorial',
        source: 'uploaded',
        step_count: 3,
      })
    })

    it('returns static tutorials before uploaded ones', async () => {
      const dir = makeTutorialsDir([{ ...VALID_TUTORIAL, id: 'static-one', title: 'Static' }])
      const localDb = createDb(':memory:')
      const a = createApp(localDb, dir)
      await request(a).post('/api/tutorials').send({ ...VALID_TUTORIAL, id: 'uploaded-one', title: 'Uploaded' })
      const res = await request(a).get('/api/tutorials')
      expect(res.body[0].id).toBe('static-one')
      expect(res.body[1].id).toBe('uploaded-one')
    })

    it('skips malformed JSON files without crashing', async () => {
      const dir = makeTutorialsDir()
      writeFileSync(join(dir, 'broken.json'), 'not json{')
      const a = createApp(createDb(':memory:'), dir)
      const res = await request(a).get('/api/tutorials')
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  describe('GET /api/tutorials/:id/steps', () => {
    it('returns steps for a static tutorial', async () => {
      const dir = makeTutorialsDir([VALID_TUTORIAL])
      const a = createApp(createDb(':memory:'), dir)
      const res = await request(a).get('/api/tutorials/test-tutorial/steps')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[0]).toMatchObject({
        tutorial_id: 'test-tutorial',
        position: 0,
        title: 'Step 1',
        code: 'note("c4")',
        fitness: [{ type: 'play' }],
      })
      expect(typeof res.body[0].id).toBe('number')
    })

    it('returns steps for an uploaded tutorial', async () => {
      await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      const res = await request(app).get('/api/tutorials/test-tutorial/steps')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[1]).toMatchObject({
        position: 1,
        title: 'Step 2',
        fitness: [
          { type: 'code_contains', value: 'e4' },
          { type: 'play' },
        ],
      })
    })

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/tutorials/no-such-id/steps')
      expect(res.status).toBe(404)
    })

    it('returns steps in position order', async () => {
      await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      const res = await request(app).get('/api/tutorials/test-tutorial/steps')
      const positions = res.body.map((s: { position: number }) => s.position)
      expect(positions).toEqual([0, 1, 2])
    })
  })

  describe('POST /api/tutorials', () => {
    it('creates an uploaded tutorial and returns TutorialMeta', async () => {
      const res = await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        id: 'test-tutorial',
        title: 'Test Tutorial',
        source: 'uploaded',
        step_count: 3,
      })
      expect(typeof res.body.created_at).toBe('number')
    })

    it('returns 400 when id is missing', async () => {
      const { id: _id, ...rest } = VALID_TUTORIAL
      const res = await request(app).post('/api/tutorials').send(rest)
      expect(res.status).toBe(400)
    })

    it('returns 400 when id has invalid chars', async () => {
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, id: 'UPPER_CASE' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when id is too short', async () => {
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, id: 'ab' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when steps is empty', async () => {
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: [] })
      expect(res.status).toBe(400)
    })

    it('returns 400 when a step has no fitness', async () => {
      const badSteps = [{ ...VALID_TUTORIAL.steps[0], fitness: [] }]
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: badSteps })
      expect(res.status).toBe(400)
    })

    it('returns 400 for unknown fitness type', async () => {
      const badSteps = [{ ...VALID_TUTORIAL.steps[0], fitness: [{ type: 'teleport' }] }]
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: badSteps })
      expect(res.status).toBe(400)
    })

    it('returns 400 when code_contains lacks value', async () => {
      const badSteps = [{ ...VALID_TUTORIAL.steps[0], fitness: [{ type: 'code_contains' }] }]
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: badSteps })
      expect(res.status).toBe(400)
    })

    it('returns 400 when quiz has only one option', async () => {
      const badSteps = [{
        ...VALID_TUTORIAL.steps[0],
        fitness: [{ type: 'quiz', question: 'Q?', options: ['only one'], answer: 0 }],
      }]
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: badSteps })
      expect(res.status).toBe(400)
    })

    it('returns 400 when quiz answer is out of bounds', async () => {
      const badSteps = [{
        ...VALID_TUTORIAL.steps[0],
        fitness: [{ type: 'quiz', question: 'Q?', options: ['a', 'b'], answer: 5 }],
      }]
      const res = await request(app).post('/api/tutorials').send({ ...VALID_TUTORIAL, steps: badSteps })
      expect(res.status).toBe(400)
    })

    it('returns 409 when id conflicts with an existing uploaded tutorial', async () => {
      await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      const res = await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      expect(res.status).toBe(409)
    })

    it('returns 409 when id conflicts with a static tutorial', async () => {
      const dir = makeTutorialsDir([VALID_TUTORIAL])
      const a = createApp(createDb(':memory:'), dir)
      const res = await request(a).post('/api/tutorials').send(VALID_TUTORIAL)
      expect(res.status).toBe(409)
    })
  })

  describe('DELETE /api/tutorials/:id', () => {
    it('deletes an uploaded tutorial', async () => {
      await request(app).post('/api/tutorials').send(VALID_TUTORIAL)
      const del = await request(app).delete('/api/tutorials/test-tutorial')
      expect(del.status).toBe(204)
      const list = await request(app).get('/api/tutorials')
      expect(list.body).toHaveLength(0)
    })

    it('returns 403 when trying to delete a static tutorial', async () => {
      const dir = makeTutorialsDir([VALID_TUTORIAL])
      const a = createApp(createDb(':memory:'), dir)
      const res = await request(a).delete('/api/tutorials/test-tutorial')
      expect(res.status).toBe(403)
    })

    it('returns 404 for unknown id', async () => {
      const res = await request(app).delete('/api/tutorials/no-such-id')
      expect(res.status).toBe(404)
    })
  })
})
