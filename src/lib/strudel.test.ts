import { describe, it, expect, vi, beforeEach } from 'vitest'

// Define mocks at module level so factories can reference them.
const mockEvaluate = vi.fn()
const mockRepl = vi.fn(() => ({ evaluate: mockEvaluate, start: vi.fn(), stop: vi.fn() }))
const mockEvalScope = vi.fn().mockResolvedValue([])
const mockLoadSamples = vi.fn().mockResolvedValue(undefined)
const mockMiniAllStrings = vi.fn()

vi.mock('@strudel/webaudio', () => ({
  webaudioRepl: mockRepl,
  samples: mockLoadSamples,
}))
vi.mock('@strudel/core', () => ({
  evalScope: mockEvalScope,
}))
vi.mock('@strudel/mini', () => ({
  miniAllStrings: mockMiniAllStrings,
}))

// Re-import the module fresh before each test so scopeReady/strudelInstance
// singletons start at null.  vi.resetModules() clears the module cache while
// preserving vi.mock() registrations, so the mocks above remain active.
let strudel: typeof import('./strudel.js')
beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  strudel = await import('./strudel.js')
})

describe('strudel', () => {
  describe('evaluate()', () => {
    it('passes static module namespaces (not Promises) to evalScope to prevent duplicate Pattern class instances', async () => {
      mockEvaluate.mockResolvedValue('pattern')

      await strudel.evaluate('note("c4")', vi.fn())

      expect(mockEvalScope).toHaveBeenCalledOnce()
      const args = mockEvalScope.mock.calls[0]
      // Must be plain objects (module namespaces), NOT Promises.
      // Dynamic import() in evalScope creates a second module instance with a
      // different Pattern class, causing "t.set is not a function" on chained calls.
      expect(args[0]).not.toBeInstanceOf(Promise)
      expect(args[1]).not.toBeInstanceOf(Promise)
      expect(args[2]).not.toBeInstanceOf(Promise)
      expect(args).toHaveLength(3)
    })

    it('calls miniAllStrings() so s("bd*4") parses mini notation instead of treating "*4" as the sound name', async () => {
      mockEvaluate.mockResolvedValue('pattern')

      await strudel.evaluate('s("bd*4")', vi.fn())

      expect(mockMiniAllStrings).toHaveBeenCalledOnce()
    })

    it('loads Dirt-Samples after evalScope so s() can resolve drum sounds', async () => {
      mockEvaluate.mockResolvedValue('pattern')

      await strudel.evaluate('s("bd sd")', vi.fn())

      expect(mockLoadSamples).toHaveBeenCalledOnce()
      expect(mockLoadSamples).toHaveBeenCalledWith('github:tidalcycles/Dirt-Samples/master/')
    })

    it('init order: evalScope → miniAllStrings → loadSamples', async () => {
      const callOrder: string[] = []
      mockEvalScope.mockImplementation(async () => { callOrder.push('evalScope'); return [] })
      mockMiniAllStrings.mockImplementation(() => { callOrder.push('miniAllStrings') })
      mockLoadSamples.mockImplementation(async () => { callOrder.push('loadSamples') })
      mockEvaluate.mockResolvedValue('pattern')

      await strudel.evaluate('note("c4")', vi.fn())

      expect(callOrder).toEqual(['evalScope', 'miniAllStrings', 'loadSamples'])
    })

    it('returns true when webaudioRepl evaluate returns a pattern', async () => {
      mockEvaluate.mockResolvedValue('a-pattern')

      const ok = await strudel.evaluate('note("c4")', vi.fn())

      expect(ok).toBe(true)
    })

    it('returns false when webaudioRepl evaluate returns undefined (eval error path)', async () => {
      // webaudioRepl resolves undefined on error and calls onEvalError internally.
      // Our wrapper must return false so the caller does not start the scheduler
      // with no pattern set ("Scheduler: no pattern set" error).
      mockEvaluate.mockResolvedValue(undefined)

      const ok = await strudel.evaluate('s("bd")', vi.fn())

      expect(ok).toBe(false)
    })

    it('does not re-run evalScope, miniAllStrings, or loadSamples on subsequent evaluate calls', async () => {
      mockEvaluate.mockResolvedValue('pattern')

      await strudel.evaluate('note("c4")', vi.fn())
      await strudel.evaluate('note("e4")', vi.fn())

      expect(mockEvalScope).toHaveBeenCalledOnce()
      expect(mockMiniAllStrings).toHaveBeenCalledOnce()
      expect(mockLoadSamples).toHaveBeenCalledOnce()
    })
  })
})
