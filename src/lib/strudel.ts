// @ts-ignore — @strudel/webaudio ships no TypeScript declarations
import { webaudioRepl } from '@strudel/webaudio'
// @ts-ignore — @strudel/core ships no TypeScript declarations
import { evalScope } from '@strudel/core'

export type StrudelError = { message: string }
export type HapsCallback = (haps: unknown[], atTime: number) => void

type StrudelInstance = {
  evaluate: (code: string) => Promise<unknown>
  start: () => void
  stop: () => void
}

let strudelInstance: StrudelInstance | null = null
let hapsCallback: HapsCallback | null = null
let scopeReady: Promise<void> | null = null

function ensureScope(): Promise<void> {
  if (!scopeReady) {
    scopeReady = evalScope(
      import('@strudel/core'),
      import('@strudel/webaudio'),
    )
  }
  return scopeReady
}

export function setHapsCallback(cb: HapsCallback | null): void {
  hapsCallback = cb
}

function getInstance(onError: (e: StrudelError) => void): StrudelInstance {
  if (!strudelInstance) {
    // webaudioRepl wraps repl() from @strudel/core with WebAudio context wired up:
    //   getTime: () => audioContext.currentTime
    //   defaultOutput: webaudioOutput
    // It returns { evaluate, start, stop, pause, toggle, scheduler, state, … }
    strudelInstance = webaudioRepl({
      onEvalError: (e: unknown) => onError({ message: String(e) }),
      onUpdateState: (s: { schedulerError?: unknown; haps?: unknown[]; atTime?: number }) => {
        if (s.schedulerError) {
          onError({ message: String(s.schedulerError) })
        }
        if (s.haps && s.atTime !== undefined && hapsCallback) {
          hapsCallback(s.haps, s.atTime)
        }
      },
    }) as StrudelInstance
  }
  return strudelInstance
}

// Returns true if evaluation succeeded and the scheduler has a pattern ready.
export async function evaluate(
  code: string,
  onError: (e: StrudelError) => void,
): Promise<boolean> {
  try {
    // Always stop before re-evaluating to prevent stacked schedulers.
    strudelInstance?.stop()
    await ensureScope()
    // webaudioRepl's evaluate() resolves to undefined on error (calls onEvalError
    // instead of rejecting), or returns the pattern on success.
    const result = await getInstance(onError).evaluate(code)
    return result !== undefined
  } catch (e) {
    onError({ message: String(e) })
    return false
  }
}

export function start(onError: (e: StrudelError) => void): void {
  getInstance(onError).start()
}

export function stop(): void {
  strudelInstance?.stop()
}

export function reset(): void {
  strudelInstance?.stop()
  strudelInstance = null
}
