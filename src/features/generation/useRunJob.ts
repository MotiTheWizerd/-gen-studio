import { useCallback } from 'react'
import { toast } from 'sonner'
import { getModel } from '@/providers/registry'
import {
  getImageModel,
  imageModels,
  runTextToImage,
  runImageEdit,
} from '@/providers/images'
import { saveGeneration } from '@/db/generations.repo'
import { useTabsStore } from '@/features/tabs/tabs.store'
import { useJobsStore } from './jobs.store'

export function useRunJob(tabId: string) {
  const addJob = useJobsStore((s) => s.addJob)
  const updateJob = useJobsStore((s) => s.updateJob)
  const cancelTab = useJobsStore((s) => s.cancelTab)
  const markRun = useTabsStore((s) => s.markRun)

  const run = useCallback(async () => {
    const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
    if (!tab) return
    const model = getModel(tab.modelId)
    if (!model) {
      toast.error(`Unknown model: ${tab.modelId}`)
      return
    }

    const selectedName =
      (tab.params.model_name as string | undefined) ??
      (model.kind === 'image' ? imageModels[0]?.model_name : undefined)
    const imageModel = selectedName ? getImageModel(selectedName) : undefined

    const controller = new AbortController()
    const aspectHint =
      typeof tab.params.image_size === 'string'
        ? (tab.params.image_size as string)
        : undefined
    const job = addJob(tabId, {
      controller,
      pct: 0,
      message: 'starting…',
      modelName: imageModel?.model_name ?? model.label,
      aspectHint,
    })
    const jobId = job.id
    const paramsSnapshot = structuredClone(tab.params)

    try {
      interface SavedMedia {
        kind: 'image' | 'video'
        blob: Blob
        mime: string
        width?: number
        height?: number
        durationMs?: number
      }

      let media: SavedMedia[]
      let modelIdForSave = model.id
      let providerIdForSave = model.providerId

      if (imageModel) {
        const inputImages =
          (paramsSnapshot.input_images as string[] | undefined) ?? []
        const useEdit =
          imageModel.model_type === 'image-to-image' ||
          (imageModel.support_edit && inputImages.length > 0)
        const pipeline = useEdit ? runImageEdit : runTextToImage
        const r = await pipeline(imageModel, paramsSnapshot, {
          signal: controller.signal,
          onProgress: (p) => updateJob(jobId, { pct: p.pct, message: p.message }),
        })
        media = r.media
        modelIdForSave = useEdit
          ? (imageModel.fal_edit_endpoint ?? imageModel.fal_endpoint)
          : imageModel.fal_endpoint
        providerIdForSave = 'fal'
      } else {
        const r = await model.run(paramsSnapshot as never, {
          signal: controller.signal,
          onProgress: (p) => updateJob(jobId, { pct: p.pct, message: p.message }),
        })
        media = r.media
      }

      const ids: string[] = []
      for (const m of media) {
        const rec = await saveGeneration({
          tabId,
          modelId: modelIdForSave,
          providerId: providerIdForSave,
          kind: m.kind,
          params: paramsSnapshot,
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
      updateJob(jobId, {
        status: 'done',
        pct: 1,
        message: undefined,
        resultIds: ids,
        endedAt: Date.now(),
      })
      toast.success(`Done · ${job.modelName ?? 'job'}`)
    } catch (err) {
      if (controller.signal.aborted) {
        updateJob(jobId, {
          status: 'cancelled',
          message: undefined,
          endedAt: Date.now(),
        })
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      updateJob(jobId, {
        status: 'error',
        error: msg,
        message: undefined,
        endedAt: Date.now(),
      })
      toast.error(msg)
    }
  }, [tabId, addJob, updateJob, markRun])

  return {
    run,
    cancelAll: () => cancelTab(tabId),
  }
}
