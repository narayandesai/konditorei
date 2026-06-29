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
        created_at: 0,
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
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as {
      id: string
      steps: Array<{ title: string; content: string; code?: string; fitness: FitnessRule[] }>
    }
    if (raw.id !== id) return null
    return raw.steps.map((s, i) => ({
      id: i + 1,
      tutorial_id: id,
      position: i,
      title: s.title,
      content: s.content,
      ...(s.code != null ? { code: s.code } : {}),
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
    if (!db.prepare('SELECT id FROM tutorials WHERE id = ?').get(id)) {
      res.status(404).json({ error: 'tutorial not found' }); return
    }
    const rows = db.prepare(
      'SELECT id, tutorial_id, position, title, content, code, fitness FROM tutorial_steps WHERE tutorial_id = ? ORDER BY position'
    ).all(id) as unknown as Array<{
      id: number; tutorial_id: string; position: number
      title: string; content: string; code: string | null; fitness: string
    }>
    const steps: TutorialStep[] = rows.map((s) => ({
      id: s.id,
      tutorial_id: s.tutorial_id,
      position: s.position,
      title: s.title,
      content: s.content,
      ...(s.code != null ? { code: s.code } : {}),
      fitness: JSON.parse(s.fitness) as FitnessRule[],
    }))
    res.json(steps)
  })

  router.post('/', (req, res) => {
    const err = validateTutorial(req.body)
    if (err) { res.status(400).json({ error: err }); return }

    const t = req.body as {
      id: string; title: string; description: string
      steps: Array<{ title: string; content: string; code?: string; fitness: FitnessRule[] }>
    }

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

    const meta = db.prepare(
      'SELECT id, title, description, source, step_count, created_at FROM tutorials WHERE id = ?'
    ).get(t.id) as unknown as TutorialMeta
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
