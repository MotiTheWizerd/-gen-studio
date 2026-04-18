import type { StateStorage } from 'zustand/middleware'

/**
 * Debounced wrapper around localStorage for zustand persist.
 *
 * The default persist writes synchronously on every state change, which for
 * this app means a multi-KB JSON.stringify + localStorage.setItem on EVERY
 * keystroke in a prompt. That blocks the main thread for 10-50ms per char.
 *
 * This wrapper coalesces writes for `delayMs` — only the final value for
 * each key is actually flushed to localStorage. Reads hit the pending buffer
 * first so in-flight writes are visible. `beforeunload` forces a flush so
 * we don't lose data on page close.
 */
export function createDebouncedStorage(delayMs: number): StateStorage {
  const pending = new Map<string, string>()
  let timer: number | undefined

  const flush = () => {
    timer = undefined
    for (const [k, v] of pending) {
      try {
        localStorage.setItem(k, v)
      } catch (err) {
        console.error('[debounced-storage] setItem failed', k, err)
      }
    }
    pending.clear()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
  }

  return {
    getItem: (key: string) => pending.get(key) ?? localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      pending.set(key, value)
      if (timer !== undefined) clearTimeout(timer)
      timer = window.setTimeout(flush, delayMs)
    },
    removeItem: (key: string) => {
      pending.delete(key)
      localStorage.removeItem(key)
    },
  }
}
