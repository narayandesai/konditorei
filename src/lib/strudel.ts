// @ts-ignore — @strudel/webaudio ships no TypeScript declarations
import { webaudioRepl } from '@strudel/webaudio'

export type StrudelError = { message: string }
export type HapsCallback = (haps: unknown[], atTime: number) => void

type StrudelInstance = {
  evaluate: (code: string) => Promise<unknown>
  start: () => void
  stop: () => void
}

let strudelInstance: StrudelInstance | null = null
let hapsCallback: HapsCallback | null = null

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

export async function evaluate(
  code: string,
  onError: (e: StrudelError) => void,
): Promise<void> {
  try {
    // Always stop before re-evaluating to prevent stacked schedulers.
    strudelInstance?.stop()
    await getInstance(onError).evaluate(code)
  } catch (e) {
    onError({ message: String(e) })
  }
}

export function start(onError: (e: StrudelError) => void): void {
  getInstance(onError).start()
}

export function stop(onError: (e: StrudelError) => void): void {
  strudelInstance?.stop()
}

export function reset(): void {
  strudelInstance?.stop()
  strudelInstance = null
}
