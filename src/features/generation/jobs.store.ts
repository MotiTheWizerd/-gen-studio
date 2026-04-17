import { create } from 'zustand'

export type JobStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface JobState {
  status: JobStatus
  pct?: number
  message?: string
  error?: string
  resultIds?: string[] // generation record ids from Dexie
  controller?: AbortController
  startedAt?: number
  endedAt?: number
}

interface JobsState {
  byTab: Record<string, JobState>
  setJob: (tabId: string, patch: Partial<JobState>) => void
  clear: (tabId: string) => void
  cancel: (tabId: string) => void
}

export const useJobsStore = create<JobsState>((set, get) => ({
  byTab: {},

  setJob: (tabId, patch) =>
    set((s) => ({
      byTab: {
        ...s.byTab,
        [tabId]: { ...(s.byTab[tabId] ?? { status: 'idle' }), ...patch },
      },
    })),

  clear: (tabId) =>
    set((s) => {
      const { [tabId]: _, ...rest } = s.byTab
      return { byTab: rest }
    }),

  cancel: (tabId) => {
    const job = get().byTab[tabId]
    job?.controller?.abort()
  },
}))
