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
}

interface JobsState {
  byTab: Record<string, JobState[]>
  addJob: (tabId: string, seed?: Partial<JobState>) => JobState
  updateJob: (jobId: string, patch: Partial<JobState>) => void
  cancelJob: (jobId: string) => void
  cancelTab: (tabId: string) => void
  clearTab: (tabId: string) => void
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
    set((s) => ({
      byTab: {
        ...s.byTab,
        [tabId]: [...(s.byTab[tabId] ?? []), job],
      },
    }))
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
          updated[idx] = { ...updated[idx], ...patch }
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
