# Tutorial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a side-panel tutorial mode that loads tutorials from static JSON files or the database, progresses users through steps by satisfying fitness criteria (play, code match, quiz), and renders markdown content alongside the live editor.

**Architecture:** A new `tutorialsRouter` merges static JSON files (read from `server/tutorials/`) with DB-uploaded tutorials. The client `useTutorial` hook owns step navigation and fitness evaluation. `TutorialPanel` renders to the left of the editor when a tutorial is active; `TutorialPicker` is a modal for choosing one.

**Tech Stack:** node:sqlite, Express, React, TypeScript, marked (markdown renderer — needs `npm install marked`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/db.ts` | Modify | Add `tutorials` + `tutorial_steps` tables |
| `src/types.ts` | Modify | Add `TutorialMeta`, `TutorialStep`, `FitnessRule` |
| `server/tests/tutorials.test.ts` | Create | Failing tests for tutorial API |
| `server/tutorials/strudel-intro.json` | Create | Placeholder tutorial (content by `/teach` later) |
| `server/routes/tutorials.ts` | Create | `tutorialsRouter(db, tutorialsDir?)` |
| `server/app.ts` | Modify | Mount `tutorialsRouter` at `/api/tutorials` |
| `src/lib/api.ts` | Modify | Add `api.tutorials.*` methods |
| `src/hooks/useTutorial.ts` | Create | Step navigation + fitness evaluation |
| `src/components/TutorialPanel.tsx` | Create | 320px side panel rendering current step |
| `src/components/TutorialPicker.tsx` | Create | Modal to browse and select a tutorial |
| `src/components/TopBar.tsx` | Modify | Add Tutorial button (right-side controls) |
| `src/App.tsx` | Modify | Tutorial state, split layout, step code loading |

---

### Task 1: DB schema + new types

**Files:**
- Modify: `server/db.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add tutorials tables to server/db.ts**

In `server/db.ts`, add two new `CREATE TABLE` statements inside the existing `db.exec()` block, after the `publications` table and its indices. The current file ends with:

```ts
      CREATE INDEX IF NOT EXISTS idx_publications_version_id ON publications(version_id);
    `)
    return db
```

Change the closing to:

```ts
      CREATE INDEX IF NOT EXISTS idx_publications_version_id ON publications(version_id);

      CREATE TABLE IF NOT EXISTS tutorials (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT NOT NULL,
        source      TEXT NOT NULL DEFAULT 'uploaded',
        step_count  INTEGER NOT NULL,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tutorial_steps (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tutorial_id TEXT NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
        position    INTEGER NOT NULL,
        title       TEXT NOT NULL,
        content     TEXT NOT NULL,
        code        TEXT,
        fitness     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tutorial_steps_tutorial_id ON tutorial_steps(tutorial_id);
    `)
    return db
```

- [ ] **Step 2: Add new types to src/types.ts**

Append to the end of `src/types.ts`:

```ts
export interface TutorialMeta {
  id: string
  title: string
  description: string
  source: 'static' | 'uploaded'
  step_count: number
}

export interface TutorialStep {
  id: number
  tutorial_id: string
  position: number
  title: string
  content: string
  code?: string
  fitness: FitnessRule[]
}

export type FitnessRule =
  | { type: 'play' }
  | { type: 'code_contains'; value: string }
  | { type: 'code_matches'; pattern: string }
  | { type: 'quiz'; question: string; options: string[]; answer: number }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/db.ts src/types.ts
git commit -m "feat: add tutorials/tutorial_steps DB tables and TS types"
```

---

### Task 2: Failing server tests for tutorial API

**Files:**
- Create: `server/tests/tutorials.test.ts`

- [ ] **Step 1: Create the test file**

Create `server/tests/tutorials.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/nld/dev/konditorei && npx vitest run server/tests/tutorials.test.ts 2>&1 | tail -20
```

Expected: FAIL — errors about `createApp` receiving wrong arg count and `tutorialsRouter` not being found.

- [ ] **Step 3: Commit the failing tests**

```bash
git add server/tests/tutorials.test.ts
git commit -m "test: add failing tests for tutorial API"
```

---

### Task 3: Static tutorial stub + tutorials router + app mounting

**Files:**
- Create: `server/tutorials/strudel-intro.json`
- Create: `server/routes/tutorials.ts`
- Modify: `server/app.ts`

Note: `createApp` in `server/app.ts` must be updated to accept an optional `tutorialsDir` parameter so tests can inject a temp directory.

- [ ] **Step 1: Create the strudel-intro stub**

Create directory `server/tutorials/` and file `server/tutorials/strudel-intro.json`:

```json
{
  "id": "strudel-intro",
  "title": "Introduction to Strudel",
  "description": "Learn live coding with Strudel patterns — step by step.",
  "steps": [
    {
      "title": "Welcome",
      "content": "# Welcome to Strudel\n\nThis tutorial will teach you live coding with Strudel patterns.\n\nPress **Play** to begin.",
      "code": "note(\"c4\")",
      "fitness": [
        { "type": "play" }
      ]
    },
    {
      "title": "Change the note",
      "content": "Replace `c4` with `e4` in the editor and press Play again.",
      "code": "note(\"c4\")",
      "fitness": [
        { "type": "code_contains", "value": "e4" },
        { "type": "play" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Implement server/routes/tutorials.ts**

Create `server/routes/tutorials.ts`:

```ts
import { Router } from 'express'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import type { Db } from '../db.js'
import type { TutorialMeta, TutorialStep, FitnessRule } from '../../src/types.js'

const DEFAULT_TUTORIALS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tutorials')

const VALID_FITNESS_TYPES = new Set(['play', 'code_contains', 'code_matches', 'quiz'])

function validateTutorial(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'body must be an object'
  const t = body as Record<string, unknown>
  if (typeof t.id !== 'string' || !/^[a-z0-9-]{3,80}$/.test(t.id)) return 'id must be 3–80 chars [a-z0-9-]'
  if (typeof t.title !== 'string' || !t.title.trim()) return 'title is required'
  if (typeof t.description !== 'string' || !t.description.trim()) return 'description is required'
  if (!Array.isArray(t.steps) || t.steps.length === 0) return 'steps must be a non-empty array'
  for (let i = 0; i < t.steps.length; i++) {
    const s = t.steps[i] as Record<string, unknown>
    if (typeof s.title !== 'string' || !s.title.trim()) return `step ${i}: title is required`
    if (typeof s.content !== 'string' || !s.content.trim()) return `step ${i}: content is required`
    if (!Array.isArray(s.fitness) || s.fitness.length === 0) return `step ${i}: fitness must be a non-empty array`
    for (let j = 0; j < s.fitness.length; j++) {
      const r = s.fitness[j] as Record<string, unknown>
      if (!VALID_FITNESS_TYPES.has(r.type as string)) return `step ${i}, rule ${j}: unknown type "${r.type}"`
      if (r.type === 'code_contains' && (typeof r.value !== 'string' || !r.value)) return `step ${i}, rule ${j}: code_contains needs value`
      if (r.type === 'code_matches' && (typeof r.pattern !== 'string' || !r.pattern)) return `step ${i}, rule ${j}: code_matches needs pattern`
      if (r.type === 'quiz') {
        if (typeof r.question !== 'string' || !r.question.trim()) return `step ${i}, rule ${j}: quiz needs question`
        if (!Array.isArray(r.options) || r.options.length < 2) return `step ${i}, rule ${j}: quiz needs at least 2 options`
        if (typeof r.answer !== 'number' || r.answer < 0 || r.answer >= (r.options as unknown[]).length) return `step ${i}, rule ${j}: quiz answer out of range`
      }
    }
  }
  return null
}

function loadStaticMeta(dir: string): TutorialMeta[] {
  if (!existsSync(dir)) return []
  const results: TutorialMeta[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as Record<string, unknown>
      if (typeof raw.id !== 'string' || !Array.isArray(raw.steps)) continue
      results.push({
        id: raw.id,
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        source: 'static',
        step_count: raw.steps.length,
      })
    } catch {
      // skip malformed files
    }
  }
  return results
}

function loadStaticSteps(dir: string, id: string): TutorialStep[] | null {
  const file = join(dir, `${id}.json`)
  if (!existsSync(file)) return null
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as { id: string; steps: Array<{ title: string; content: string; code?: string; fitness: FitnessRule[] }> }
    if (raw.id !== id) return null
    return raw.steps.map((s, i) => ({
      id: i + 1,
      tutorial_id: id,
      position: i,
      title: s.title,
      content: s.content,
      code: s.code,
      fitness: s.fitness,
    }))
  } catch {
    return null
  }
}

function isStaticId(dir: string, id: string): boolean {
  return existsSync(join(dir, `${id}.json`))
}

export function tutorialsRouter(db: Db, tutorialsDir: string = DEFAULT_TUTORIALS_DIR) {
  const router = Router()

  router.get('/', (_req, res) => {
    const staticMeta = loadStaticMeta(tutorialsDir)
    const staticIds = new Set(staticMeta.map((m) => m.id))
    const uploaded = db.prepare(
      'SELECT id, title, description, source, step_count, created_at FROM tutorials ORDER BY created_at DESC'
    ).all() as unknown as TutorialMeta[]
    const filteredUploaded = uploaded.filter((u) => !staticIds.has(u.id))
    res.json([...staticMeta, ...filteredUploaded])
  })

  router.get('/:id/steps', (req, res) => {
    const { id } = req.params
    const staticSteps = loadStaticSteps(tutorialsDir, id)
    if (staticSteps) { res.json(staticSteps); return }
    const dbSteps = db.prepare(
      'SELECT id, tutorial_id, position, title, content, code FROM tutorial_steps WHERE tutorial_id = ? ORDER BY position'
    ).all(id) as unknown as Array<{ id: number; tutorial_id: string; position: number; title: string; content: string; code: string | null }>
    if (dbSteps.length === 0) {
      if (!db.prepare('SELECT id FROM tutorials WHERE id = ?').get(id)) {
        res.status(404).json({ error: 'tutorial not found' }); return
      }
    }
    const fitnessRows = db.prepare(
      'SELECT id, fitness FROM tutorial_steps WHERE tutorial_id = ? ORDER BY position'
    ).all(id) as unknown as Array<{ id: number; fitness: string }>
    const fitnessMap = new Map(fitnessRows.map((r) => [r.id, JSON.parse(r.fitness) as FitnessRule[]]))
    const steps: TutorialStep[] = dbSteps.map((s) => ({
      id: s.id,
      tutorial_id: s.tutorial_id,
      position: s.position,
      title: s.title,
      content: s.content,
      ...(s.code != null ? { code: s.code } : {}),
      fitness: fitnessMap.get(s.id) ?? [],
    }))
    res.json(steps)
  })

  router.post('/', (req, res) => {
    const err = validateTutorial(req.body)
    if (err) { res.status(400).json({ error: err }); return }

    const t = req.body as { id: string; title: string; description: string; steps: Array<{ title: string; content: string; code?: string; fitness: FitnessRule[] }> }

    if (isStaticId(tutorialsDir, t.id)) {
      res.status(409).json({ error: 'id conflicts with a static tutorial' }); return
    }
    if (db.prepare('SELECT id FROM tutorials WHERE id = ?').get(t.id)) {
      res.status(409).json({ error: 'id already in use' }); return
    }

    const now = Date.now()
    db.prepare(
      'INSERT INTO tutorials (id, title, description, source, step_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(t.id, t.title, t.description, 'uploaded', t.steps.length, now)

    for (let i = 0; i < t.steps.length; i++) {
      const s = t.steps[i]
      db.prepare(
        'INSERT INTO tutorial_steps (tutorial_id, position, title, content, code, fitness) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(t.id, i, s.title, s.content, s.code ?? null, JSON.stringify(s.fitness))
    }

    const meta = db.prepare('SELECT id, title, description, source, step_count, created_at FROM tutorials WHERE id = ?').get(t.id) as unknown as TutorialMeta
    res.status(201).json(meta)
  })

  router.delete('/:id', (req, res) => {
    const { id } = req.params
    if (isStaticId(tutorialsDir, id)) {
      res.status(403).json({ error: 'static tutorials cannot be deleted' }); return
    }
    if (!db.prepare('SELECT id FROM tutorials WHERE id = ?').get(id)) {
      res.status(404).json({ error: 'tutorial not found' }); return
    }
    db.prepare('DELETE FROM tutorials WHERE id = ?').run(id)
    res.status(204).send()
  })

  return router
}
```

- [ ] **Step 3: Update server/app.ts to accept tutorialsDir and mount the router**

Current `server/app.ts`:

```ts
import express from 'express'
import type { Db } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'
import { songPublicationsRouter, publicationsMutationRouter, publicPlayerRouter } from './routes/publications.js'
export function createApp(db: Db) {
```

Replace with:

```ts
import express from 'express'
import type { Db } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'
import { songPublicationsRouter, publicationsMutationRouter, publicPlayerRouter } from './routes/publications.js'
import { tutorialsRouter } from './routes/tutorials.js'

export function createApp(db: Db, tutorialsDir?: string) {
  const app = express()
  app.use(express.json())
  app.use('/api/users', usersRouter(db))
  app.use('/api/songs', songsRouter(db))
  app.use('/api/songs', versionsRouter(db))
  app.use('/api/songs', songPublicationsRouter(db))
  app.use('/api/publications', publicationsMutationRouter(db))
  app.use('/api', publicPlayerRouter(db))
  app.use('/api/tutorials', tutorialsRouter(db, tutorialsDir))
  return app
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/nld/dev/konditorei && npx vitest run server/tests/tutorials.test.ts 2>&1 | tail -20
```

Expected: all tutorial tests pass.

- [ ] **Step 5: Run all server tests to confirm no regressions**

```bash
cd /home/nld/dev/konditorei && npx vitest run server/tests/ 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/tutorials/strudel-intro.json server/routes/tutorials.ts server/app.ts
git commit -m "feat: implement tutorials API with static + uploaded tutorial support"
```

---

### Task 4: Client API methods

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add tutorial types to the import and add tutorials namespace**

In `src/lib/api.ts`, update the import at line 1:

```ts
import type { User, Song, Version, VersionWithCode, DiffLine, Publication, PublicationPatch, PublicPlayerResponse, TutorialMeta, TutorialStep } from '../types.js'
```

Then add `tutorials` to the `api` object (after `publications`):

```ts
  tutorials: {
    list: () => req<TutorialMeta[]>('GET', '/tutorials'),
    steps: (id: string) => req<TutorialStep[]>('GET', `/tutorials/${id}/steps`),
    upload: (tutorial: unknown) => req<TutorialMeta>('POST', '/tutorials', tutorial),
    delete: (id: string) => req<void>('DELETE', `/tutorials/${id}`),
  },
```

- [ ] **Step 2: Type-check**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add api.tutorials client methods"
```

---

### Task 5: useTutorial hook

**Files:**
- Create: `src/hooks/useTutorial.ts`

- [ ] **Step 1: Create src/hooks/useTutorial.ts**

```ts
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { TutorialStep, FitnessRule } from '../types.js'

export interface TutorialControls {
  steps: TutorialStep[]
  currentIndex: number
  currentStep: TutorialStep | null
  fitness: boolean[]
  allPassed: boolean
  quizAnswers: (number | null)[]
  goNext: () => void
  goPrev: () => void
  onQuizAnswer: (ruleIndex: number, answer: number) => void
}

export function useTutorial(
  tutorialId: string | null,
  editorCode: string,
  isPlaying: boolean,
): TutorialControls {
  const [steps, setSteps] = useState<TutorialStep[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])

  useEffect(() => {
    if (!tutorialId) {
      setSteps([])
      setCurrentIndex(0)
      setQuizAnswers([])
      return
    }
    let cancelled = false
    api.tutorials.steps(tutorialId).then((s) => {
      if (cancelled) return
      setSteps(s)
      setCurrentIndex(0)
      setQuizAnswers(new Array(s[0]?.fitness.length ?? 0).fill(null))
    }).catch(() => {
      if (!cancelled) setSteps([])
    })
    return () => { cancelled = true }
  }, [tutorialId])

  useEffect(() => {
    const step = steps[currentIndex]
    setQuizAnswers(new Array(step?.fitness.length ?? 0).fill(null))
  }, [currentIndex, steps])

  const currentStep = steps[currentIndex] ?? null

  function evalRule(rule: FitnessRule, ruleIndex: number): boolean {
    switch (rule.type) {
      case 'play': return isPlaying
      case 'code_contains': return editorCode.includes(rule.value)
      case 'code_matches': {
        try { return new RegExp(rule.pattern).test(editorCode) } catch { return false }
      }
      case 'quiz': return quizAnswers[ruleIndex] === rule.answer
    }
  }

  const fitness = currentStep?.fitness.map((r, i) => evalRule(r, i)) ?? []
  const allPassed = fitness.length > 0 && fitness.every(Boolean)

  function goNext() {
    const next = currentIndex + 1
    if (next < steps.length) setCurrentIndex(next)
  }

  function goPrev() {
    const prev = currentIndex - 1
    if (prev >= 0) setCurrentIndex(prev)
  }

  function onQuizAnswer(ruleIndex: number, answer: number) {
    setQuizAnswers((prev) => {
      const next = [...prev]
      next[ruleIndex] = answer
      return next
    })
  }

  return {
    steps,
    currentIndex,
    currentStep,
    fitness,
    allPassed,
    quizAnswers,
    goNext,
    goPrev,
    onQuizAnswer,
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTutorial.ts
git commit -m "feat: add useTutorial hook with step navigation and fitness evaluation"
```

---

### Task 6: TutorialPanel component

**Files:**
- Create: `src/components/TutorialPanel.tsx`

Note: This task requires the `marked` package. Install it first.

- [ ] **Step 1: Install marked**

```bash
cd /home/nld/dev/konditorei && npm install marked
```

Expected: `marked` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create src/components/TutorialPanel.tsx**

```tsx
import { marked } from 'marked'
import type { TutorialControls } from '../hooks/useTutorial.js'
import type { FitnessRule } from '../types.js'

interface TutorialPanelProps {
  tutorialTitle: string
  controls: TutorialControls
  onExit: () => void
}

function fitnessLabel(rule: FitnessRule): string {
  switch (rule.type) {
    case 'play': return 'Press Play'
    case 'code_contains': return `Code contains "${rule.value}"`
    case 'code_matches': return `Code matches /${rule.pattern}/`
    case 'quiz': return 'Answer the question'
  }
}

export function TutorialPanel({ tutorialTitle, controls, onExit }: TutorialPanelProps) {
  const { steps, currentIndex, currentStep, fitness, allPassed, quizAnswers, goNext, goPrev, onQuizAnswer } = controls

  if (!currentStep) return null

  const contentHtml = String(marked.parse(currentStep.content))

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tutorialTitle}
        </span>
        <button
          onClick={onExit}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}
        >
          Exit
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Progress */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          STEP {currentIndex + 1} OF {steps.length}
        </div>

        {/* Step title */}
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentStep.title}
        </div>

        {/* Markdown content */}
        <div
          // eslint-disable-next-line react/no-danger -- tutorial content is author-controlled, not user-generated
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}
        />

        {/* Quiz UI */}
        {currentStep.fitness.map((rule, ruleIndex) => {
          if (rule.type !== 'quiz') return null
          return (
            <div key={ruleIndex} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{rule.question}</div>
              {rule.options.map((opt, i) => {
                const selected = quizAnswers[ruleIndex] === i
                return (
                  <button
                    key={i}
                    onClick={() => onQuizAnswer(ruleIndex, i)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: selected ? 'var(--accent)' : 'var(--bg-overlay)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      color: selected ? '#fff' : 'var(--text-primary)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )
        })}

        {/* Fitness checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {currentStep.fitness.map((rule, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: fitness[i] ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600, width: 14, flexShrink: 0 }}>
                {fitness[i] ? '✓' : '○'}
              </span>
              <span style={{ color: fitness[i] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {fitnessLabel(rule)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
            padding: '5px 12px',
            borderRadius: 4,
            cursor: currentIndex === 0 ? 'default' : 'pointer',
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <button
          onClick={goNext}
          disabled={!allPassed || currentIndex === steps.length - 1}
          style={{
            background: allPassed && currentIndex < steps.length - 1 ? 'var(--accent)' : 'var(--bg-overlay)',
            border: `1px solid ${allPassed && currentIndex < steps.length - 1 ? 'var(--accent)' : 'var(--border)'}`,
            color: allPassed && currentIndex < steps.length - 1 ? '#fff' : 'var(--text-muted)',
            padding: '5px 12px',
            borderRadius: 4,
            cursor: allPassed && currentIndex < steps.length - 1 ? 'pointer' : 'default',
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TutorialPanel.tsx package.json package-lock.json
git commit -m "feat: add TutorialPanel component with markdown rendering"
```

---

### Task 7: TutorialPicker component

**Files:**
- Create: `src/components/TutorialPicker.tsx`

- [ ] **Step 1: Create src/components/TutorialPicker.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { TutorialMeta } from '../types.js'

interface TutorialPickerProps {
  onSelect: (id: string, title: string) => void
  onClose: () => void
}

export function TutorialPicker({ onSelect, onClose }: TutorialPickerProps) {
  const [tutorials, setTutorials] = useState<TutorialMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.tutorials.list()
      .then((list) => { setTutorials(list); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
        width: 520, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Choose a Tutorial</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading…</div>
          )}
          {!loading && tutorials.length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No tutorials available.</div>
          )}
          {tutorials.map((t) => (
            <div
              key={t.id}
              onClick={() => { onSelect(t.id, t.title); onClose() }}
              style={{
                padding: '12px 18px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-overlay)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: t.source === 'static' ? 'var(--bg-overlay)' : 'rgba(var(--accent-rgb,99,102,241),0.15)',
                  color: t.source === 'static' ? 'var(--text-muted)' : 'var(--accent)',
                  border: '1px solid var(--border)',
                }}>
                  {t.source === 'static' ? 'Static' : 'Uploaded'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.step_count} steps</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TutorialPicker.tsx
git commit -m "feat: add TutorialPicker modal component"
```

---

### Task 8: Wire TopBar and App

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Tutorial button to TopBar**

In `src/components/TopBar.tsx`, add three props to `TopBarProps`:

```ts
  onTutorialOpen: () => void
  activeTutorialTitle: string | null
  onTutorialExit: () => void
```

In the `TopBar` function destructuring, add the three new props:

```ts
  onTutorialOpen, activeTutorialTitle, onTutorialExit,
```

In the right-side controls `<div>` (the one with `marginLeft: 'auto'`), add a Tutorial button as the first child (before the visualizer `<select>`):

```tsx
        {activeTutorialTitle ? (
          <button
            onClick={onTutorialExit}
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 4, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title="Exit tutorial"
          >
            {activeTutorialTitle.length > 22 ? activeTutorialTitle.slice(0, 20) + '…' : activeTutorialTitle} ×
          </button>
        ) : (
          <button
            onClick={onTutorialOpen}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 4, fontSize: 12 }}
          >
            Tutorial
          </button>
        )}
```

- [ ] **Step 2: Update App.tsx**

Replace the full contents of `src/App.tsx` with:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useActiveUser } from './hooks/useActiveUser.js'
import { useSongs } from './hooks/useSongs.js'
import { useVersions } from './hooks/useVersions.js'
import { usePublications } from './hooks/usePublications.js'
import { useTutorial } from './hooks/useTutorial.js'
import { PublicationsModal } from './components/PublicationsModal.js'
import { TopBar, type Visualizer } from './components/TopBar.js'
import { Editor } from './components/Editor.js'
import { VersionModal } from './components/VersionModal.js'
import { Visualizer as VisualizerPanel } from './components/Visualizer.js'
import { TutorialPanel } from './components/TutorialPanel.js'
import { TutorialPicker } from './components/TutorialPicker.js'
import * as strudel from './lib/strudel.js'
import type { StrudelError, HapsCallback } from './lib/strudel.js'

export function App() {
  const { users, activeUser, setActiveUser, createUser } = useActiveUser()
  const { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong } = useSongs(activeUser?.id)
  const { versions, latestCode, saveVersion, revertTo } = useVersions(activeSong?.id)
  const { publications, createPublication, updatePublication, deletePublication } = usePublications(activeSong?.id)
  const [showPublicationsModal, setShowPublicationsModal] = useState(false)

  const [editorCode, setEditorCode] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [strudelError, setStrudelError] = useState<string | null>(null)
  const [visualizer, setVisualizer] = useState<Visualizer>('none')
  const highlightRef = useRef<HapsCallback | null>(null)

  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null)
  const [activeTutorialTitle, setActiveTutorialTitle] = useState<string | null>(null)
  const [showTutorialPicker, setShowTutorialPicker] = useState(false)

  const tutorial = useTutorial(activeTutorialId, editorCode, isPlaying)

  function handleError(e: StrudelError) {
    setStrudelError(e.message)
  }

  function handlePublishSong(id: number) {
    const song = songs.find((s) => s.id === id)
    if (song && song.id !== activeSong?.id) setActiveSong(song)
    setShowPublicationsModal(true)
  }

  // Sync editorCode whenever the server-loaded latestCode changes (initial load or song switch).
  useEffect(() => {
    setEditorCode(latestCode)
  }, [latestCode])

  useEffect(() => {
    strudel.setHapsCallback((haps, atTime) => highlightRef.current?.(haps, atTime))
    return () => strudel.setHapsCallback(null)
  }, [])

  // Stop playback when the active song changes so we never layer two schedulers.
  useEffect(() => {
    strudel.reset()
    setIsPlaying(false)
  }, [activeSong?.id])

  // Load step code into editor when the tutorial step changes.
  useEffect(() => {
    if (tutorial.currentStep?.code != null) {
      setEditorCode(tutorial.currentStep.code)
    }
  }, [tutorial.currentIndex, tutorial.steps])

  function handleTutorialSelect(id: string, title: string) {
    setActiveTutorialId(id)
    setActiveTutorialTitle(title)
  }

  function handleTutorialExit() {
    setActiveTutorialId(null)
    setActiveTutorialTitle(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 44, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <TopBar
          users={users}
          activeUser={activeUser}
          onUserSelect={setActiveUser}
          onCreateUser={createUser}
          songs={songs}
          activeSong={activeSong}
          onSongSelect={setActiveSong}
          onCreateSong={createSong}
          onRenameSong={renameSong}
          onDeleteSong={deleteSong}
          onPublishSong={handlePublishSong}
          latestVersion={versions[versions.length - 1] ?? null}
          onShowVersions={() => setShowVersionModal(true)}
          onSaveVersion={() => saveVersion(editorCode)}
          isPlaying={isPlaying}
          onPlay={() => {
            strudel.evaluate(editorCode, handleError)
              .then(() => { strudel.start(handleError); setIsPlaying(true) })
              .catch((e: unknown) => handleError({ message: String(e) }))
          }}
          onStop={() => {
            strudel.stop()
            setIsPlaying(false)
          }}
          visualizer={visualizer}
          onVisualizerChange={setVisualizer}
          onTutorialOpen={() => setShowTutorialPicker(true)}
          activeTutorialTitle={activeTutorialTitle}
          onTutorialExit={handleTutorialExit}
        />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: activeTutorialId ? 'row' : 'column' }}>
        {activeTutorialId && activeTutorialTitle && (
          <TutorialPanel
            tutorialTitle={activeTutorialTitle}
            controls={tutorial}
            onExit={handleTutorialExit}
          />
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              code={editorCode}
              onChange={setEditorCode}
              onRegisterHighlight={(fn) => { highlightRef.current = fn ?? null }}
            />
          </div>
          <VisualizerPanel type={visualizer} isPlaying={isPlaying} />
        </div>
      </div>
      {strudelError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: 'var(--red)', color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13 }}>
          {strudelError}
          <button onClick={() => setStrudelError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#fff' }}>×</button>
        </div>
      )}
      {showVersionModal && activeSong && (
        <VersionModal
          songId={activeSong.id}
          versions={versions}
          onRevert={(v) => revertTo(v)}
          onClose={() => setShowVersionModal(false)}
        />
      )}
      {showPublicationsModal && activeSong && (
        <PublicationsModal
          songName={activeSong.name}
          versions={versions}
          publications={publications}
          onCreatePublication={createPublication}
          onUpdatePublication={updatePublication}
          onDeletePublication={deletePublication}
          onClose={() => setShowPublicationsModal(false)}
        />
      )}
      {showTutorialPicker && (
        <TutorialPicker
          onSelect={handleTutorialSelect}
          onClose={() => setShowTutorialPicker(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd /home/nld/dev/konditorei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd /home/nld/dev/konditorei && npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopBar.tsx src/App.tsx
git commit -m "feat: wire tutorial mode into App and TopBar — split layout + step code loading"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Covered in task |
|-----------------|-----------------|
| Static JSON tutorials from `server/tutorials/` | Task 3 (`loadStaticMeta`, `loadStaticSteps`) |
| Uploaded tutorials stored in DB | Task 3 (`POST /api/tutorials`, DB insert) |
| `GET /api/tutorials` merges both, static first | Task 3 (`GET /` handler) |
| `GET /api/tutorials/:id/steps` for both sources | Task 3 (checks static then DB) |
| `POST /api/tutorials` validates + 400/409 | Task 3 (`validateTutorial`) |
| `DELETE /api/tutorials/:id` — 403 for static, 404 for unknown | Task 3 |
| `TutorialMeta`, `TutorialStep`, `FitnessRule` types | Task 1 |
| `tutorials` + `tutorial_steps` DB tables + FK index | Task 1 |
| `api.tutorials.*` client methods | Task 4 |
| `useTutorial` hook with step nav + fitness eval | Task 5 |
| `play` / `code_contains` / `code_matches` / `quiz` fitness rules | Task 5 (`evalRule`) |
| Quiz answers tracked per fitness rule position, reset on step change | Task 5 (`useEffect` on `currentIndex`) |
| Step code loaded into editor when step changes | Task 8 (`useEffect` on `tutorial.currentIndex, tutorial.steps`) |
| `TutorialPanel` 320px left panel | Task 6 |
| Markdown rendering via `marked` | Task 6 (`dangerouslySetInnerHTML`) |
| Quiz UI in panel | Task 6 |
| Fitness checklist in panel | Task 6 |
| Prev/Next nav — Next disabled until `allPassed` | Task 6 |
| `TutorialPicker` modal with source badge + step count | Task 7 |
| Tutorial button in TopBar (open picker / exit with title) | Task 8 |
| Split layout when tutorial active | Task 8 (flex `row`/`column` switch) |
| Static tutorial stub `strudel-intro.json` | Task 3, Step 1 |
| `createApp` accepts optional `tutorialsDir` for test injection | Task 3, Step 3 |
| Malformed JSON files skipped silently | Task 3 (`loadStaticMeta` try/catch) |

### Placeholder Scan

No TBDs, TODOs, or vague instructions. All steps include complete code.

### Type Consistency

- `TutorialControls` (defined in `useTutorial.ts`, used in `TutorialPanel.tsx`) — consistent.
- `TutorialMeta`, `TutorialStep`, `FitnessRule` defined in Task 1, used in Tasks 3, 4, 5, 6, 7 — consistent.
- `api.tutorials.steps(id)` returns `TutorialStep[]` — matches `useTutorial` consumption.
- `createApp(db, tutorialsDir?)` — tests in Task 2 pass `tutorialsDir` as second arg; router implementation in Task 3 accepts it.
- `onSelect: (id: string, title: string) => void` in `TutorialPicker` — matches `handleTutorialSelect` in `App.tsx`.
