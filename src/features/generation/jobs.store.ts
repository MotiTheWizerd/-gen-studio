import { nanoid } from 'nanoid'
import { create } from 'zustand'

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface JobState {
  id: string
  tabId: string
  status: JobStatus
  pct?: number
  message?: string
  error?: string
  resultIds?: string[]
  controller?: AbortController
  startedAt?: number
  endedAt?: number
  modelName?: string
  aspectHint?: string
}

interface JobsState {
  byTab: Record<string, JobState[]>
  addJob: (tabId: string, seed?: Partial<JobState>) => JobState
  updateJob: (jobId: string, patch: Partial<JobState>) => void
  cancelJob: (jobId: string) => void
  cancelTab: (tabId: string) => void
  clearTab: (tabId: string) => void
}

const MAX_TERMINAL_JOBS_PER_TAB = 8

function pruneTerminal(list: JobState[]): JobState[] {
  // Keep all running jobs, plus the most recent N terminal jobs.
  let keptTerminal = 0
  const reversed: JobState[] = []
  for (let i = list.length - 1; i >= 0; i--) {
    const j = list[i]
    if (j.status === 'running') {
      reversed.push(j)
    } else if (keptTerminal < MAX_TERMINAL_JOBS_PER_TAB) {
      reversed.push(j)
      keptTerminal++
    }
  }
  return reversed.reverse()
}

export const useJobsStore = create<JobsState>((set, get) => ({
  byTab: {},

  addJob: (tabId, seed = {}) => {
    const job: JobState = {
      id: nanoid(8),
      tabId,
      status: 'running',
      startedAt: Date.now(),
      ...seed,
    }
    set((s) => {
      const existing = s.byTab[tabId] ?? []
      const pruned = pruneTerminal(existing)
      return {
        byTab: {
          ...s.byTab,
          [tabId]: [...pruned, job],
        },
      }
    })
    return job
  },

  updateJob: (jobId, patch) =>
    set((s) => {
      const next: Record<string, JobState[]> = { ...s.byTab }
      for (const tabId of Object.keys(next)) {
        const list = next[tabId]
        const idx = list.findIndex((j) => j.id === jobId)
        if (idx !== -1) {
          const updated = [...list]
          let merged: JobState = { ...updated[idx], ...patch }
          // Drop the AbortController on terminal transitions so the
          // controller (and any closures it holds) can be GC'd.
          if (
            patch.status &&
            patch.status !== 'running' &&
            merged.controller
          ) {
            merged = { ...merged, controller: undefined }
          }
          updated[idx] = merged
          next[tabId] = updated
          break
        }
      }
      return { byTab: next }
    }),

  cancelJob: (jobId) => {
    for (const list of Object.values(get().byTab)) {
      const j = list.find((x) => x.id === jobId)
      if (j) {
        j.controller?.abort()
        return
      }
    }
  },

  cancelTab: (tabId) => {
    for (const j of get().byTab[tabId] ?? []) {
      if (j.status === 'running') j.controller?.abort()
    }
  },

  clearTab: (tabId) =>
    set((s) => {
      const { [tabId]: _, ...rest } = s.byTab
      return { byTab: rest }
    }),
}))

const EMPTY_JOBS: readonly JobState[] = Object.freeze([])

export function selectTabJobs(tabId: string) {
  return (s: JobsState) => s.byTab[tabId] ?? (EMPTY_JOBS as JobState[])
}
