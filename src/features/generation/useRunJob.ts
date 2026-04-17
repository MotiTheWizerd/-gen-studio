import { useCallback } from 'react'
import { toast } from 'sonner'
import { getModel } from '@/providers/registry'
import { saveGeneration } from '@/db/generations.repo'
import { useTabsStore } from '@/features/tabs/tabs.store'
import { useJobsStore } from './jobs.store'

export function useRunJob(tabId: string) {
  const setJob = useJobsStore((s) => s.setJob)
  const cancel = useJobsStore((s) => s.cancel)
  const tab = useTabsStore((s) => s.tabs.find((t) => t.id === tabId))
  const markRun = useTabsStore((s) => s.markRun)

  const run = useCallback(async () => {
    if (!tab) return
    const model = getModel(tab.modelId)
    if (!model) {
      toast.error(`Unknown model: ${tab.modelId}`)
      return
    }

    const controller = new AbortController()
    setJob(tabId, {
      status: 'running',
      pct: 0,
      message: 'starting…',
      error: undefined,
      controller,
      startedAt: Date.now(),
      endedAt: undefined,
    })

    try {
      const result = await model.run(tab.params as never, {
        signal: controller.signal,
        onProgress: (p) => setJob(tabId, { pct: p.pct, message: p.message }),
      })

      const ids: string[] = []
      for (const m of result.media) {
        const rec = await saveGeneration({
          tabId,
          modelId: model.id,
          providerId: model.providerId,
          kind: m.kind,
          params: tab.params,
          media: [
            {
              kind: m.kind,
              blob: m.blob,
              mime: m.mime,
              width: m.width,
              height: m.height,
              durationMs: m.durationMs,
            },
          ],
        })
        ids.push(rec.id)
      }

      markRun(tabId)
      setJob(tabId, {
        status: 'done',
        pct: 1,
        message: undefined,
        resultIds: ids,
        endedAt: Date.now(),
      })
      toast.success('Done')
    } catch (err) {
      if (controller.signal.aborted) {
        setJob(tabId, {
          status: 'cancelled',
          message: undefined,
          endedAt: Date.now(),
        })
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setJob(tabId, {
        status: 'error',
        error: msg,
        message: undefined,
        endedAt: Date.now(),
      })
      toast.error(msg)
    }
  }, [tab, tabId, setJob, markRun])

  return {
    run,
    cancel: () => cancel(tabId),
  }
}
