/**
 * Tiny structured logger. Each call:
 *   [vibe][scope] +1234ms  message  {data}
 *
 * `scope.timer()` returns a thunk that logs an elapsed-ms line when called.
 */

const t0 = performance.now()

function ts(): string {
  const ms = Math.round(performance.now() - t0)
  return `+${ms.toString().padStart(5)}ms`
}

export interface Logger {
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
  /** Returns a fn that, when called, logs the elapsed time since timer() was created. */
  timer: (label: string) => () => number
}

export function createLogger(scope: string): Logger {
  const tag = `[vibe][${scope}]`
  return {
    info: (msg, data) => {
      if (data !== undefined) console.log(tag, ts(), msg, data)
      else console.log(tag, ts(), msg)
    },
    warn: (msg, data) => {
      if (data !== undefined) console.warn(tag, ts(), msg, data)
      else console.warn(tag, ts(), msg)
    },
    error: (msg, data) => {
      if (data !== undefined) console.error(tag, ts(), msg, data)
      else console.error(tag, ts(), msg)
    },
    timer: (label) => {
      const start = performance.now()
      return () => {
        const elapsed = Math.round(performance.now() - start)
        console.log(tag, ts(), `⏱ ${label} took ${elapsed}ms`)
        return elapsed
      }
    },
  }
}
