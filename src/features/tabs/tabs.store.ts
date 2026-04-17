import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getModel } from '@/providers/registry'

export interface GenTab {
  id: string
  title: string
  modelId: string
  params: Record<string, unknown>
  createdAt: number
  lastRunAt?: number
}

interface TabsState {
  tabs: GenTab[]
  activeId: string | null

  open: (modelId: string) => string
  close: (id: string) => void
  setActive: (id: string) => void
  rename: (id: string, title: string) => void
  updateParams: (id: string, patch: Record<string, unknown>) => void
  markRun: (id: string) => void
  reorder: (fromId: string, toId: string) => void
  closeAll: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [],
      activeId: null,

      open: (modelId) => {
        const model = getModel(modelId)
        if (!model) throw new Error(`Unknown model: ${modelId}`)
        const id = nanoid(8)
        const tab: GenTab = {
          id,
          title: model.label,
          modelId,
          params: structuredClone(model.defaults),
          createdAt: Date.now(),
        }
        set((s) => ({ tabs: [...s.tabs, tab], activeId: id }))
        return id
      },

      close: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id)
          if (idx === -1) return s
          const tabs = s.tabs.filter((t) => t.id !== id)
          let activeId = s.activeId
          if (activeId === id) {
            activeId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null
          }
          return { tabs, activeId }
        }),

      setActive: (id) => set({ activeId: id }),

      rename: (id, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
        })),

      updateParams: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, params: { ...t.params, ...patch } } : t,
          ),
        })),

      markRun: (id) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, lastRunAt: Date.now() } : t,
          ),
        })),

      reorder: (fromId, toId) =>
        set((s) => {
          const from = s.tabs.findIndex((t) => t.id === fromId)
          const to = s.tabs.findIndex((t) => t.id === toId)
          if (from === -1 || to === -1 || from === to) return s
          const tabs = s.tabs.slice()
          const [moved] = tabs.splice(from, 1)
          tabs.splice(to, 0, moved)
          return { tabs }
        }),

      closeAll: () => set({ tabs: [], activeId: null }),
    }),
    {
      name: 'vibe-studio-tabs',
      version: 1,
      partialize: (s) => ({ tabs: s.tabs, activeId: s.activeId }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Drop tabs whose model disappeared (e.g. provider removed)
        const valid = state.tabs.filter((t) => getModel(t.modelId))
        if (valid.length !== state.tabs.length) {
          state.tabs = valid
          if (state.activeId && !valid.find((t) => t.id === state.activeId)) {
            state.activeId = valid[0]?.id ?? null
          }
        }
      },
    },
  ),
)
