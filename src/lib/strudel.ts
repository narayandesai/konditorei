// @ts-ignore — @strudel/webaudio ships no TypeScript declarations
import { webaudioRepl } from '@strudel/webaudio'

export type StrudelError = { message: string }

type StrudelInstance = {
  evaluate: (code: string) => Promise<unknown>
  start: () => void
  stop: () => void
}

let strudelInstance: StrudelInstance | null = null

function getInstance(onError: (e: StrudelError) => void): StrudelInstance {
  if (!strudelInstance) {
    // webaudioRepl wraps repl() from @strudel/core with WebAudio context wired up:
    //   getTime: () => audioContext.currentTime
    //   defaultOutput: webaudioOutput
    // It returns { evaluate, start, stop, pause, toggle, scheduler, state, … }
    strudelInstance = webaudioRepl({
      onEvalError: (e: unknown) => onError({ message: String(e) }),
      onUpdateState: (s: { schedulerError?: unknown }) => {
        if (s.schedulerError) {
          onError({ message: String(s.schedulerError) })
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
    await getInstance(onError).evaluate(code)
  } catch (e) {
    onError({ message: String(e) })
  }
}

export function start(onError: (e: StrudelError) => void): void {
  getInstance(onError).start()
}

export function stop(onError: (e: StrudelError) => void): void {
  getInstance(onError).stop()
}
