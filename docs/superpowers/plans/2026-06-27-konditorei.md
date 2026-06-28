# Konditorei Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully local web application for composing Strudel music with explicit versioning, multi-user support, and visualizer integration.

**Architecture:** Single Node.js process running Express with Vite as middleware. Express handles `/api/*` routes backed by SQLite; Vite handles the React SPA with HMR. In production, the React app is built into `dist/` and Express serves it statically.

**Tech Stack:** Node.js, Express, better-sqlite3, React, Vite, TypeScript, CodeMirror 6, @strudel/core, @strudel/webaudio, @strudel/codemirror, vitest, supertest

---

## File Map

```
konditorei/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root layout: TopBar + Editor + Visualizer
│   ├── index.css                   # Global styles + CSS custom properties
│   ├── types.ts                    # Shared types (User, Song, Version, DiffLine)
│   ├── lib/
│   │   ├── api.ts                  # Typed fetch wrappers for all REST endpoints
│   │   └── strudel.ts              # Strudel bootstrap: evaluate, start, stop
│   ├── hooks/
│   │   ├── useActiveUser.ts        # Active user from localStorage
│   │   ├── useSongs.ts             # Song list + CRUD for active user
│   │   └── useVersions.ts          # Version list + save/revert for active song
│   └── components/
│       ├── TopBar.tsx              # User switcher, song selector, version badge, play controls
│       ├── Editor.tsx              # CodeMirror editor with Strudel syntax
│       ├── VersionModal.tsx        # Version list + diff view + revert
│       └── Visualizer.tsx          # Strudel visualizer panel (below editor)
├── server/
│   ├── index.ts                    # Entry point: starts Express + Vite middleware
│   ├── app.ts                      # Express app factory (takes db, for testability)
│   ├── db.ts                       # SQLite schema + createDb factory
│   ├── diff.ts                     # LCS line diff algorithm
│   └── routes/
│       ├── users.ts                # GET /api/users, POST /api/users
│       ├── songs.ts                # CRUD /api/songs
│       └── versions.ts             # /api/songs/:id/versions, diff, revert
└── server/tests/
    ├── diff.test.ts
    ├── users.test.ts
    ├── songs.test.ts
    └── versions.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "konditorei",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@strudel/core": "^1.0.0",
    "@strudel/webaudio": "^1.0.0",
    "@strudel/codemirror": "^1.0.0",
    "@codemirror/view": "^6.0.0",
    "@codemirror/state": "^6.0.0",
    "better-sqlite3": "^9.0.0",
    "express": "^4.18.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/supertest": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "supertest": "^6.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist-server",
    "rootDir": ".",
    "baseUrl": "."
  },
  "include": ["src", "server"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vite.config.ts
git commit -m "chore: project scaffold"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/types.ts
export interface User {
  id: number
  name: string
  created_at: number
}

export interface Song {
  id: number
  user_id: number
  name: string
  created_at: number
}

export interface Version {
  id: number
  song_id: number
  number: number
  created_at: number
}

export interface VersionWithCode extends Version {
  code: string
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared types"
```

---

## Task 3: Database Module

**Files:**
- Create: `server/db.ts`

- [ ] **Step 1: Write db.ts**

```typescript
// server/db.ts
import Database from 'better-sqlite3'

export function createDb(filename = 'konditorei.db') {
  const db = new Database(filename)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    PRAGMA foreign_keys = ON;
  `)
  return db
}

export type Db = ReturnType<typeof createDb>
```

- [ ] **Step 2: Commit**

```bash
git add server/db.ts
git commit -m "feat: database schema"
```

---

## Task 4: Diff Utility

**Files:**
- Create: `server/diff.ts`
- Create: `server/tests/diff.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/tests/diff.test.ts
import { describe, it, expect } from 'vitest'
import { diffLines } from '../diff.js'

describe('diffLines', () => {
  it('returns unchanged lines when code is identical', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ])
  })

  it('marks added lines', () => {
    const result = diffLines('a\nb', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'added', text: 'c' },
    ])
  })

  it('marks removed lines', () => {
    const result = diffLines('a\nb\nc', 'a\nc')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ])
  })

  it('handles replaced lines', () => {
    const result = diffLines('a\nb', 'a\nz')
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'z' },
    ])
  })

  it('handles empty old string', () => {
    const result = diffLines('', 'a\nb')
    expect(result).toEqual([
      { type: 'added', text: 'a' },
      { type: 'added', text: 'b' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- server/tests/diff.test.ts
```

Expected: FAIL — `diffLines` not found.

- [ ] **Step 3: Implement diff.ts**

```typescript
// server/diff.ts
import type { DiffLine } from '../src/types.js'

export function diffLines(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode === '' ? [] : oldCode.split('\n')
  const newLines = newCode === '' ? [] : newCode.split('\n')
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Traceback
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- server/tests/diff.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/diff.ts server/tests/diff.test.ts
git commit -m "feat: LCS line diff utility"
```

---

## Task 5: Express App Factory

**Files:**
- Create: `server/app.ts`

- [ ] **Step 1: Write app.ts**

```typescript
// server/app.ts
import express from 'express'
import type { Db } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'

export function createApp(db: Db) {
  const app = express()
  app.use(express.json())
  app.use('/api/users', usersRouter(db))
  app.use('/api/songs', songsRouter(db))
  app.use('/api/songs', versionsRouter(db))
  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add server/app.ts
git commit -m "feat: express app factory"
```

---

## Task 6: Users API Routes

**Files:**
- Create: `server/routes/users.ts`
- Create: `server/tests/users.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- server/tests/users.test.ts
```

Expected: FAIL — router not found.

- [ ] **Step 3: Implement users.ts**

```typescript
// server/routes/users.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { User } from '../../src/types.js'

export function usersRouter(db: Db) {
  const router = Router()

  router.get('/', (_req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at').all() as User[]
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
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as User
    res.status(201).json(user)
  })

  return router
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- server/tests/users.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/users.ts server/tests/users.test.ts
git commit -m "feat: users API"
```

---

## Task 7: Songs API Routes

**Files:**
- Create: `server/routes/songs.ts`
- Create: `server/tests/songs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- server/tests/songs.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement songs.ts**

```typescript
// server/routes/songs.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { Song } from '../../src/types.js'

export function songsRouter(db: Db) {
  const router = Router()

  router.get('/', (req, res) => {
    const { userId } = req.query
    if (!userId) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    const songs = db
      .prepare('SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC')
      .all(Number(userId)) as Song[]
    res.json(songs)
  })

  router.post('/', (req, res) => {
    const { userId, name } = req.body
    if (!userId || !name) {
      res.status(400).json({ error: 'userId and name are required' })
      return
    }
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO songs (user_id, name, created_at) VALUES (?, ?, ?)')
      .run(userId, name, created_at)
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(result.lastInsertRowid) as Song
    res.status(201).json(song)
  })

  router.patch('/:id', (req, res) => {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    db.prepare('UPDATE songs SET name = ? WHERE id = ?').run(name, req.params.id)
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id) as Song | undefined
    if (!song) { res.status(404).json({ error: 'not found' }); return }
    res.json(song)
  })

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id)
    res.status(204).send()
  })

  return router
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- server/tests/songs.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/songs.ts server/tests/songs.test.ts
git commit -m "feat: songs API"
```

---

## Task 8: Versions API Routes

**Files:**
- Create: `server/routes/versions.ts`
- Create: `server/tests/versions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- server/tests/versions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement versions.ts**

```typescript
// server/routes/versions.ts
import { Router } from 'express'
import type { Db } from '../db.js'
import type { Version, VersionWithCode } from '../../src/types.js'
import { diffLines } from '../diff.js'

export function versionsRouter(db: Db) {
  const router = Router()

  router.get('/:songId/versions', (req, res) => {
    const versions = db
      .prepare('SELECT id, song_id, number, created_at FROM versions WHERE song_id = ? ORDER BY number')
      .all(req.params.songId) as Version[]
    res.json(versions)
  })

  router.post('/:songId/versions', (req, res) => {
    const { code } = req.body
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code is required' })
      return
    }
    const last = db
      .prepare('SELECT number FROM versions WHERE song_id = ? ORDER BY number DESC LIMIT 1')
      .get(req.params.songId) as { number: number } | undefined
    const number = (last?.number ?? 0) + 1
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO versions (song_id, number, code, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.songId, number, code, created_at)
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(result.lastInsertRowid) as VersionWithCode
    res.status(201).json(version)
  })

  router.get('/:songId/versions/:v/diff', (req, res) => {
    const v = Number(req.params.v)
    const [current, previous] = db
      .prepare('SELECT * FROM versions WHERE song_id = ? AND number IN (?, ?) ORDER BY number')
      .all(req.params.songId, v - 1, v) as VersionWithCode[]

    if (!current) { res.status(404).json({ error: 'version not found' }); return }

    const oldCode = previous?.code ?? ''
    const newCode = current.code
    res.json(diffLines(oldCode, newCode))
  })

  router.post('/:songId/revert/:v', (req, res) => {
    const target = db
      .prepare('SELECT * FROM versions WHERE song_id = ? AND number = ?')
      .get(req.params.songId, req.params.v) as VersionWithCode | undefined
    if (!target) { res.status(404).json({ error: 'version not found' }); return }

    const last = db
      .prepare('SELECT number FROM versions WHERE song_id = ? ORDER BY number DESC LIMIT 1')
      .get(req.params.songId) as { number: number }
    const number = last.number + 1
    const created_at = Date.now()
    const result = db
      .prepare('INSERT INTO versions (song_id, number, code, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.songId, number, target.code, created_at)
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(result.lastInsertRowid) as VersionWithCode
    res.status(201).json(version)
  })

  return router
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- server/tests/versions.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/versions.ts server/tests/versions.test.ts
git commit -m "feat: versions API with diff and revert"
```

---

## Task 9: Dev Server Entry Point

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: Write server/index.ts**

```typescript
// server/index.ts
import express from 'express'
import { createServer as createViteServer } from 'vite'
import { createDb } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'

const PORT = 3000
const isProd = process.env.NODE_ENV === 'production'

async function main() {
  const db = createDb()
  const app = express()
  app.use(express.json())

  app.use('/api/users', usersRouter(db))
  app.use('/api/songs', songsRouter(db))
  app.use('/api/songs', versionsRouter(db))

  if (isProd) {
    const { default: sirv } = await import('sirv')
    app.use(sirv('dist', { single: true }))
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, () => {
    console.log(`Konditorei running at http://localhost:${PORT}`)
  })
}

main()
```

- [ ] **Step 2: Add sirv dependency**

```bash
npm install sirv
```

- [ ] **Step 3: Start dev server and verify it starts**

```bash
npm run dev
```

Expected: "Konditorei running at http://localhost:3000" — no errors.  
Visit `http://localhost:3000/api/users` — should return `[]`.

- [ ] **Step 4: Stop the server (Ctrl+C) and commit**

```bash
git add server/index.ts package.json package-lock.json
git commit -m "feat: dev server with vite middleware"
```

---

## Task 10: API Client

**Files:**
- Create: `src/lib/api.ts`

- [ ] **Step 1: Write api.ts**

```typescript
// src/lib/api.ts
import type { User, Song, Version, VersionWithCode, DiffLine } from '../types.js'

const base = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  users: {
    list: () => req<User[]>('GET', '/users'),
    create: (name: string) => req<User>('POST', '/users', { name }),
  },
  songs: {
    list: (userId: number) => req<Song[]>('GET', `/songs?userId=${userId}`),
    create: (userId: number, name: string) => req<Song>('POST', '/songs', { userId, name }),
    rename: (id: number, name: string) => req<Song>('PATCH', `/songs/${id}`, { name }),
    delete: (id: number) => req<void>('DELETE', `/songs/${id}`),
  },
  versions: {
    list: (songId: number) => req<Version[]>('GET', `/songs/${songId}/versions`),
    save: (songId: number, code: string) => req<VersionWithCode>('POST', `/songs/${songId}/versions`, { code }),
    diff: (songId: number, v: number) => req<DiffLine[]>('GET', `/songs/${songId}/versions/${v}/diff`),
    revert: (songId: number, v: number) => req<VersionWithCode>('POST', `/songs/${songId}/revert/${v}`),
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: typed API client"
```

---

## Task 11: Active User Hook

**Files:**
- Create: `src/hooks/useActiveUser.ts`

- [ ] **Step 1: Write useActiveUser.ts**

```typescript
// src/hooks/useActiveUser.ts
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { User } from '../types.js'

const STORAGE_KEY = 'konditorei:activeUserId'

export function useActiveUser() {
  const [users, setUsers] = useState<User[]>([])
  const [activeUser, setActiveUserState] = useState<User | null>(null)

  useEffect(() => {
    api.users.list().then((all) => {
      setUsers(all)
      const storedId = Number(localStorage.getItem(STORAGE_KEY))
      const found = all.find((u) => u.id === storedId) ?? all[0] ?? null
      setActiveUserState(found)
    })
  }, [])

  function setActiveUser(user: User) {
    localStorage.setItem(STORAGE_KEY, String(user.id))
    setActiveUserState(user)
  }

  async function createUser(name: string): Promise<User> {
    const user = await api.users.create(name)
    setUsers((prev) => [...prev, user])
    setActiveUser(user)
    return user
  }

  return { users, activeUser, setActiveUser, createUser }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useActiveUser.ts
git commit -m "feat: active user hook with localStorage"
```

---

## Task 12: Song and Version State Hooks

**Files:**
- Create: `src/hooks/useSongs.ts`
- Create: `src/hooks/useVersions.ts`

- [ ] **Step 1: Write useSongs.ts**

```typescript
// src/hooks/useSongs.ts
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Song } from '../types.js'

export function useSongs(userId: number | undefined) {
  const [songs, setSongs] = useState<Song[]>([])
  const [activeSong, setActiveSong] = useState<Song | null>(null)

  useEffect(() => {
    if (!userId) return
    api.songs.list(userId).then((all) => {
      setSongs(all)
      setActiveSong(all[0] ?? null)
    })
  }, [userId])

  async function createSong(name: string): Promise<Song> {
    if (!userId) throw new Error('no active user')
    const song = await api.songs.create(userId, name)
    setSongs((prev) => [song, ...prev])
    setActiveSong(song)
    return song
  }

  async function renameSong(id: number, name: string) {
    const updated = await api.songs.rename(id, name)
    setSongs((prev) => prev.map((s) => (s.id === id ? updated : s)))
    if (activeSong?.id === id) setActiveSong(updated)
  }

  async function deleteSong(id: number) {
    await api.songs.delete(id)
    const remaining = songs.filter((s) => s.id !== id)
    setSongs(remaining)
    if (activeSong?.id === id) setActiveSong(remaining[0] ?? null)
  }

  return { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong }
}
```

- [ ] **Step 2: Write useVersions.ts**

```typescript
// src/hooks/useVersions.ts
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Version, VersionWithCode } from '../types.js'

export function useVersions(songId: number | undefined) {
  const [versions, setVersions] = useState<Version[]>([])
  const [latestCode, setLatestCode] = useState<string>('')

  useEffect(() => {
    if (!songId) { setVersions([]); setLatestCode(''); return }
    api.versions.list(songId).then(async (all) => {
      setVersions(all)
      if (all.length === 0) { setLatestCode(''); return }
      const latest = all[all.length - 1]
      // Fetch code for the latest version via diff (or save a fresh version endpoint)
      // The list endpoint omits code; fetch latest via revert-trick or add a GET /:v endpoint.
      // For now, cache latest code in state after each save/revert.
      // Initial load: fetch latest version code via a dedicated endpoint (see note below).
      setLatestCode('')
    })
  }, [songId])

  async function saveVersion(code: string): Promise<VersionWithCode> {
    if (!songId) throw new Error('no active song')
    const version = await api.versions.save(songId, code)
    setVersions((prev) => [...prev, version])
    setLatestCode(version.code)
    return version
  }

  async function revertTo(v: number): Promise<VersionWithCode> {
    if (!songId) throw new Error('no active song')
    const version = await api.versions.revert(songId, v)
    setVersions((prev) => [...prev, version])
    setLatestCode(version.code)
    return version
  }

  return { versions, latestCode, saveVersion, revertTo }
}
```

> **Note:** The version list endpoint omits `code` to keep payloads small. Add a `GET /api/songs/:id/versions/:v` endpoint to `versions.ts` that returns a single `VersionWithCode`, then use it in `useVersions` to load the latest version's code on mount. Add this to `versionsRouter`:
>
> ```typescript
> router.get('/:songId/versions/:v', (req, res) => {
>   const version = db
>     .prepare('SELECT * FROM versions WHERE song_id = ? AND number = ?')
>     .get(req.params.songId, req.params.v) as VersionWithCode | undefined
>   if (!version) { res.status(404).json({ error: 'not found' }); return }
>   res.json(version)
> })
> ```
>
> And update `api.ts`:
> ```typescript
> get: (songId: number, v: number) => req<VersionWithCode>('GET', `/songs/${songId}/versions/${v}`),
> ```
>
> Then in `useVersions`, after fetching the list, call `api.versions.get(songId, latest.number)` to load the initial code.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSongs.ts src/hooks/useVersions.ts
git commit -m "feat: song and version state hooks"
```

---

## Task 13: Strudel Bootstrap

**Files:**
- Create: `src/lib/strudel.ts`

> **Important:** Verify the exact Strudel API against the installed package versions before implementing. The packages `@strudel/core` and `@strudel/webaudio` export a `repl` function (or similar). Check `node_modules/@strudel/core/dist/index.js` exports if documentation is unclear.

- [ ] **Step 1: Write strudel.ts**

```typescript
// src/lib/strudel.ts
// NOTE: verify these imports against installed @strudel/* versions
import { repl } from '@strudel/core'
import { webaudioOutput, getAudioContext } from '@strudel/webaudio'

export type StrudelError = { message: string; line?: number }

let strudelInstance: ReturnType<typeof repl> | null = null

export function getStrudel(onError: (e: StrudelError) => void) {
  if (!strudelInstance) {
    strudelInstance = repl({
      defaultOutput: webaudioOutput,
      getTime: () => getAudioContext().currentTime,
      onSchedulerError: (e: unknown) => onError({ message: String(e) }),
      onEvalError: (e: unknown) => onError({ message: String(e) }),
    })
  }
  return strudelInstance
}

export async function evaluate(code: string, onError: (e: StrudelError) => void) {
  const s = getStrudel(onError)
  try {
    await s.evaluate(code)
  } catch (e) {
    onError({ message: String(e) })
  }
}

export function start(onError: (e: StrudelError) => void) {
  getStrudel(onError).scheduler.start()
}

export function stop(onError: (e: StrudelError) => void) {
  getStrudel(onError).scheduler.stop()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/strudel.ts
git commit -m "feat: strudel bootstrap module"
```

---

## Task 14: App Shell

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Konditorei</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create src/main.tsx**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { App } from './App.js'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Create src/index.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-base: #0d1117;
  --bg-surface: #161b22;
  --bg-overlay: #21262d;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --green: #3fb950;
  --red: #f85149;
  --font-mono: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
}

html, body, #root {
  height: 100%;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
}

button {
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
```

- [ ] **Step 4: Create src/App.tsx (shell — components stubbed)**

```tsx
// src/App.tsx
import { useState } from 'react'
import { useActiveUser } from './hooks/useActiveUser.js'
import { useSongs } from './hooks/useSongs.js'
import { useVersions } from './hooks/useVersions.js'

export function App() {
  const { users, activeUser, setActiveUser, createUser } = useActiveUser()
  const { songs, activeSong, setActiveSong, createSong, renameSong, deleteSong } = useSongs(activeUser?.id)
  const { versions, latestCode, saveVersion, revertTo } = useVersions(activeSong?.id)

  const [editorCode, setEditorCode] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [strudelError, setStrudelError] = useState<string | null>(null)

  // Sync editor when active song/version changes
  // (handled in useVersions — latestCode drives editor initial value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 44, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* TopBar goes here — Task 15 */}
        <span style={{ color: 'var(--text-secondary)', padding: '0 16px', lineHeight: '44px', fontSize: 12 }}>KONDITOREI</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* Editor goes here — Task 16 */}
        <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Editor placeholder</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Start dev server and verify the shell loads**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see a dark page with "KONDITOREI" and "Editor placeholder". No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.tsx src/App.tsx src/index.css
git commit -m "feat: app shell"
```

---

## Task 15: TopBar Component

**Files:**
- Create: `src/components/TopBar.tsx`

- [ ] **Step 1: Write TopBar.tsx**

```tsx
// src/components/TopBar.tsx
import { useState, useRef, useEffect } from 'react'
import type { User, Song, Version } from '../types.js'

export type Visualizer = 'none' | 'pianoroll' | 'scope' | 'spiral'

interface TopBarProps {
  users: User[]
  activeUser: User | null
  onUserSelect: (user: User) => void
  onCreateUser: (name: string) => void
  songs: Song[]
  activeSong: Song | null
  onSongSelect: (song: Song) => void
  onCreateSong: (name: string) => void
  onRenameSong: (id: number, name: string) => void
  onDeleteSong: (id: number) => void
  latestVersion: Version | null
  onShowVersions: () => void
  onSaveVersion: () => void
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  visualizer: Visualizer
  onVisualizerChange: (v: Visualizer) => void
}

export function TopBar({
  users, activeUser, onUserSelect, onCreateUser,
  songs, activeSong, onSongSelect, onCreateSong, onRenameSong, onDeleteSong,
  latestVersion, onShowVersions,
  onSaveVersion, isPlaying, onPlay, onStop,
  visualizer, onVisualizerChange,
}: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [songMenuOpen, setSongMenuOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  function handleRename(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && activeSong && nameInput.trim()) {
      onRenameSong(activeSong.id, nameInput.trim())
      setEditingName(false)
    }
    if (e.key === 'Escape') setEditingName(false)
  }

  const ts = latestVersion
    ? new Date(latestVersion.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: 10, position: 'relative' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em', flexShrink: 0 }}>KONDITOREI</span>
      <span style={{ color: 'var(--border)' }}>|</span>

      {/* User switcher */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4 }}
        >
          {activeUser?.name ?? 'no user'} ▾
        </button>
        {userMenuOpen && (
          <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 160, zIndex: 100 }}>
            {users.map((u) => (
              <div key={u.id}
                onClick={() => { onUserSelect(u); setUserMenuOpen(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', color: u.id === activeUser?.id ? 'var(--accent)' : 'var(--text-primary)' }}
              >{u.name}</div>
            ))}
            <div
              onClick={() => { const name = prompt('New user name:'); if (name) { onCreateUser(name); setUserMenuOpen(false) } }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--green)', borderTop: '1px solid var(--border)' }}
            >+ New User</div>
          </div>
        )}
      </div>

      <span style={{ color: 'var(--border)' }}>|</span>

      {/* Song selector */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setSongMenuOpen((o) => !o)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, minWidth: 140 }}
        >
          {activeSong?.name ?? 'no songs'} ▾
        </button>
        {songMenuOpen && (
          <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 200, zIndex: 100 }}>
            {songs.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div onClick={() => { onSongSelect(s); setSongMenuOpen(false) }}
                  style={{ flex: 1, padding: '8px 12px', cursor: 'pointer', color: s.id === activeSong?.id ? 'var(--accent)' : 'var(--text-primary)' }}
                >{s.name}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${s.name}"?`)) { onDeleteSong(s.id); setSongMenuOpen(false) } }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '8px' }}
                >✕</button>
              </div>
            ))}
            <div
              onClick={() => { const name = prompt('New song name:'); if (name) { onCreateSong(name); setSongMenuOpen(false) } }}
              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--green)', borderTop: '1px solid var(--border)' }}
            >+ New Song</div>
          </div>
        )}
      </div>

      {/* Version badge */}
      {latestVersion && (
        <button
          onClick={onShowVersions}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, padding: '3px 6px' }}
        >
          v{latestVersion.number} · {ts}
        </button>
      )}

      {/* Right side controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={visualizer}
          onChange={(e) => onVisualizerChange(e.target.value as Visualizer)}
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 4, fontSize: 12 }}
        >
          <option value="none">No Visualizer</option>
          <option value="pianoroll">Piano Roll</option>
          <option value="scope">Scope</option>
          <option value="spiral">Spiral</option>
        </select>

        <button
          onClick={onSaveVersion}
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 4 }}
        >
          Save Version
        </button>

        {!isPlaying ? (
          <button onClick={onPlay} style={{ background: '#238636', border: 'none', color: '#fff', padding: '4px 14px', borderRadius: 4 }}>
            ▶ Play
          </button>
        ) : (
          <button onClick={onStop} style={{ background: '#da3633', border: 'none', color: '#fff', padding: '4px 14px', borderRadius: 4 }}>
            ■ Stop
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire TopBar into App.tsx**

Replace the placeholder top bar div in `App.tsx` with:

```tsx
import { TopBar, type Visualizer } from './components/TopBar.js'

// Add to App state:
const [visualizer, setVisualizer] = useState<Visualizer>('none')

// Replace the placeholder div content:
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
  latestVersion={versions[versions.length - 1] ?? null}
  onShowVersions={() => setShowVersionModal(true)}
  onSaveVersion={() => saveVersion(editorCode)}
  isPlaying={isPlaying}
  onPlay={() => { /* Task 16 */ }}
  onStop={() => { /* Task 16 */ }}
  visualizer={visualizer}
  onVisualizerChange={setVisualizer}
/>
```

- [ ] **Step 3: Verify in browser — top bar renders with all controls**

```bash
npm run dev
```

Visit `http://localhost:3000` — top bar visible. User/song dropdowns open. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.tsx src/App.tsx
git commit -m "feat: TopBar component"
```

---

## Task 16: Editor Component

**Files:**
- Create: `src/components/Editor.tsx`

> **Note:** `@strudel/codemirror` provides a CodeMirror 6 language extension for Strudel syntax. Check its exports: it likely exports a `strudel()` function returning a `LanguageSupport`. If that package isn't available or doesn't work, fall back to `@codemirror/lang-javascript` — Strudel syntax is valid JavaScript.

- [ ] **Step 1: Write Editor.tsx**

```tsx
// src/components/Editor.tsx
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'

// Try @strudel/codemirror first; fall back to javascript if unavailable
// import { strudel } from '@strudel/codemirror'
import { javascript } from '@codemirror/lang-javascript'

interface EditorProps {
  code: string
  onChange: (code: string) => void
}

export function Editor({ code, onChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          basicSetup,
          oneDark,
          javascript(), // replace with strudel() if @strudel/codemirror works
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
  }, []) // mount once

  // Sync external code changes (e.g. version revert) without re-mounting
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      })
    }
  }, [code])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}
```

- [ ] **Step 2: Install codemirror packages**

```bash
npm install codemirror @codemirror/state @codemirror/view @codemirror/lang-javascript @codemirror/theme-one-dark
```

- [ ] **Step 3: Wire Editor into App.tsx**

```tsx
import { Editor } from './components/Editor.js'

// Replace the editor placeholder div:
<Editor code={latestCode} onChange={setEditorCode} />
```

Update the layout so the editor takes remaining height:

```tsx
<div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
  <div style={{ flex: 1, overflow: 'hidden' }}>
    <Editor code={latestCode} onChange={setEditorCode} />
  </div>
</div>
```

- [ ] **Step 4: Wire up Play/Stop in App.tsx**

```tsx
import * as strudel from './lib/strudel.js'

// Replace the onPlay/onStop placeholders:
onPlay={() => {
  strudel.evaluate(editorCode, (e) => setStrudelError(e.message))
    .then(() => { strudel.start((e) => setStrudelError(e.message)); setIsPlaying(true) })
}}
onStop={() => {
  strudel.stop((e) => setStrudelError(e.message))
  setIsPlaying(false)
}}
```

- [ ] **Step 5: Verify in browser — editor loads, you can type, Play triggers audio**

Start the server and test:
1. Create a user and a song
2. Type `note("c3 e3 g3").slow(2)` in the editor
3. Click Play — should hear audio
4. Click Stop — audio stops

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor.tsx src/App.tsx package.json package-lock.json
git commit -m "feat: CodeMirror editor with Strudel playback"
```

---

## Task 17: Version Modal

**Files:**
- Create: `src/components/VersionModal.tsx`

- [ ] **Step 1: Write VersionModal.tsx**

```tsx
// src/components/VersionModal.tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { Version, DiffLine } from '../types.js'

interface VersionModalProps {
  songId: number
  versions: Version[]
  onRevert: (v: number) => void
  onClose: () => void
}

export function VersionModal({ songId, versions, onRevert, onClose }: VersionModalProps) {
  const [selectedV, setSelectedV] = useState<number>(versions[versions.length - 1]?.number ?? 1)
  const [diff, setDiff] = useState<DiffLine[]>([])

  useEffect(() => {
    if (!selectedV) return
    api.versions.diff(songId, selectedV).then(setDiff)
  }, [songId, selectedV])

  const selectedVersion = versions.find((v) => v.number === selectedV)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Version list */}
          <div style={{ width: 160, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
            {[...versions].reverse().map((v) => (
              <div key={v.number}
                onClick={() => setSelectedV(v.number)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderLeft: `2px solid ${v.number === selectedV ? 'var(--accent)' : 'transparent'}`,
                  background: v.number === selectedV ? 'var(--bg-overlay)' : 'transparent',
                }}
              >
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                  v{v.number}
                  {v.number === versions[versions.length - 1]?.number && (
                    <span style={{ color: 'var(--green)', fontSize: 11, marginLeft: 6 }}>current</span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Diff view */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-base)' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11 }}>
              {selectedV > 1 ? `v${selectedV - 1} → v${selectedV}` : `v${selectedV} (initial)`}
            </div>
            {diff.map((line, i) => (
              <div key={i} style={{
                padding: '0 4px',
                borderRadius: 2,
                background: line.type === 'added' ? '#1a3a2a' : line.type === 'removed' ? '#3d1a1a' : 'transparent',
                color: line.type === 'added' ? 'var(--green)' : line.type === 'removed' ? 'var(--red)' : 'var(--text-secondary)',
                whiteSpace: 'pre',
              }}>
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          {selectedVersion && selectedVersion.number !== versions[versions.length - 1]?.number && (
            <button
              onClick={() => { onRevert(selectedVersion.number); onClose() }}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 14px', borderRadius: 4 }}
            >
              Revert to v{selectedVersion.number}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire VersionModal into App.tsx**

```tsx
import { VersionModal } from './components/VersionModal.js'

// Add below the editor div (inside the return):
{showVersionModal && activeSong && (
  <VersionModal
    songId={activeSong.id}
    versions={versions}
    onRevert={(v) => revertTo(v)}
    onClose={() => setShowVersionModal(false)}
  />
)}
```

- [ ] **Step 3: Verify in browser**

1. Save two versions of a song (type something, click Save Version, change it, Save Version again)
2. Click the version badge — modal opens
3. Click v1 in the list — diff shows the change
4. Click Revert to v1 — editor updates to v1's code

- [ ] **Step 4: Commit**

```bash
git add src/components/VersionModal.tsx src/App.tsx
git commit -m "feat: version history modal with diff and revert"
```

---

## Task 18: Visualizer Component

**Files:**
- Create: `src/components/Visualizer.tsx`

> **Note:** Strudel's visualizers are canvas-based and driven by pattern event callbacks. Check `@strudel/draw` or similar packages for the canvas drawing API. The exact integration depends on which visualizer packages are available. The component below implements the panel structure; the canvas rendering needs to be wired to Strudel's draw hooks once you verify the API.

- [ ] **Step 1: Write Visualizer.tsx**

```tsx
// src/components/Visualizer.tsx
import { useEffect, useRef } from 'react'
import type { Visualizer as VisualizerType } from './TopBar.js'

interface VisualizerProps {
  type: VisualizerType
  isPlaying: boolean
}

export function Visualizer({ type, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (type === 'none' || !canvasRef.current) return

    // TODO: wire to Strudel's draw API
    // Example (verify against @strudel/draw exports):
    //
    // import { Pattern } from '@strudel/core'
    // import { piano } from '@strudel/pianoroll'   // pianoroll visualizer
    // import { scope } from '@strudel/draw'         // scope visualizer
    //
    // The draw hook receives pattern events via Strudel's scheduler.
    // Register a draw callback with the active repl instance:
    //
    // const cleanup = getStrudel(...).scheduler.on('draw', (haps, time, ctx) => {
    //   drawPianoroll(canvasRef.current, haps, time)
    // })
    // return cleanup
  }, [type, isPlaying])

  if (type === 'none') return null

  return (
    <div style={{ height: 200, borderTop: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
```

- [ ] **Step 2: Wire Visualizer into App.tsx**

Update the editor section in App.tsx to include the visualizer panel below the editor:

```tsx
import { Visualizer } from './components/Visualizer.js'

// Replace the editor flex container:
<div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
  <div style={{ flex: 1, overflow: 'hidden' }}>
    <Editor code={latestCode} onChange={setEditorCode} />
  </div>
  <Visualizer type={visualizer} isPlaying={isPlaying} />
</div>
```

- [ ] **Step 3: Verify in browser**

Select "Piano Roll" from the visualizer picker — a 200px panel appears below the editor. Select "No Visualizer" — panel disappears.

- [ ] **Step 4: Complete the Strudel draw integration**

Check `node_modules/@strudel/` for available visualizer packages and their APIs. Implement the draw callback in `Visualizer.tsx` following the pattern in the TODO comment above. The Strudel GitHub source (`packages/draw/` and `packages/pianoroll/`) is the authoritative reference.

- [ ] **Step 5: Commit**

```bash
git add src/components/Visualizer.tsx src/App.tsx
git commit -m "feat: visualizer panel"
```

---

## Task 19: Production Build Smoke Test

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Expected: `dist/` directory created, no build errors.

- [ ] **Step 3: Start in production mode and verify**

```bash
NODE_ENV=production npm start
```

Visit `http://localhost:3000` — app loads from `dist/`, API endpoints work. Create a user, create a song, type code, save a version, play audio.

- [ ] **Step 4: Add .gitignore**

```
node_modules/
dist/
konditorei.db
.superpowers/
```

```bash
echo -e "node_modules/\ndist/\nkonditorei.db\n.superpowers/" > .gitignore
git add .gitignore
git commit -m "chore: gitignore"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # verify no sensitive files
git commit -m "feat: konditorei v0.1 complete"
```
