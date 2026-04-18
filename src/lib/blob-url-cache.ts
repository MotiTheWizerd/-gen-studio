// Refcounted ObjectURL cache keyed by stable id (e.g. generation record id).
// Dexie hands back fresh Blob references on every read, which previously
// caused every <img> in the gallery to revoke + recreate its URL on every
// store change — triggering a full re-decode of the entire gallery.
// Caching by id stabilises the URL across blob re-fetches.

interface Entry {
  url: string
  refs: number
  releaseTimer?: number
}

const cache = new Map<string, Entry>()

export function acquireBlobUrl(id: string, blob: Blob): string {
  const existing = cache.get(id)
  if (existing) {
    if (existing.releaseTimer !== undefined) {
      clearTimeout(existing.releaseTimer)
      existing.releaseTimer = undefined
    }
    existing.refs++
    return existing.url
  }
  const url = URL.createObjectURL(blob)
  cache.set(id, { url, refs: 1 })
  return url
}

export function releaseBlobUrl(id: string) {
  const entry = cache.get(id)
  if (!entry) return
  entry.refs--
  if (entry.refs > 0) return
  // Delay revoke a tick so React strict-mode double-invocation of effects
  // doesn't churn the URL on the same render.
  entry.releaseTimer = window.setTimeout(() => {
    URL.revokeObjectURL(entry.url)
    cache.delete(id)
  }, 100)
}

export function dropBlobUrl(id: string) {
  const entry = cache.get(id)
  if (!entry) return
  if (entry.releaseTimer !== undefined) clearTimeout(entry.releaseTimer)
  URL.revokeObjectURL(entry.url)
  cache.delete(id)
}
