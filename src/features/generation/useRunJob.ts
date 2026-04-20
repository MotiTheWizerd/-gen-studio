import { useCallback } from 'react'
import { toast } from 'sonner'
import { getModel } from '@/providers/registry'
import {
  getImageModel,
  imageModels,
  runTextToImage,
  runImageEdit,
  runKontextLoraInpaint,
} from '@/providers/images'
import { saveGeneration } from '@/db/generations.repo'
import { useTabsStore } from '@/features/tabs/tabs.store'
import { applyPersonaToParams } from '@/features/characters/applyPersona'
import { applyPersonaSwitcherToParams } from '@/features/characters/personaSwitcher'
import { createLogger } from '@/lib/log'
import { useJobsStore } from './jobs.store'

const log = createLogger('run-job')

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

    // The imageModels[] flat system is wired only to the stub provider's
    // image shell — it's the "catch-all" that fans out to the fal-hosted
    // model dropdown inside ParamsPanel. Other image-kind providers (like
    // modelslab) must use their own Model.run() path.
    const usesFalImageShell = model.providerId === 'stub' && model.kind === 'image'
    const selectedName = usesFalImageShell
      ? ((tab.params.model_name as string | undefined) ?? imageModels[0]?.model_name)
      : undefined
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
    let paramsSnapshot = structuredClone(tab.params)

    log.info('▶ run start', {
      jobId,
      tabId,
      modelId: model.id,
      modelKind: model.kind,
      mode: paramsSnapshot.mode,
      personaId: paramsSnapshot.persona_id,
      hasInputImages:
        ((paramsSnapshot.input_images as unknown[] | undefined)?.length ?? 0) > 0,
      imageModel: imageModel?.model_name,
    })
    const stopRun = log.timer('full run')

    try {
      paramsSnapshot = await applyPersonaToParams(paramsSnapshot)
      paramsSnapshot = await applyPersonaSwitcherToParams(paramsSnapshot, {
        signal: controller.signal,
        onProgress: (msg) => updateJob(jobId, { message: msg }),
      })
      interface SavedMedia {
        kind: 'image' | 'video'
        blob: Blob
        mime: string
        width?: number
        height?: number
        durationMs?: number
      }

      let media: SavedMedia[] = []
      let text: string | undefined
      let usage: import('@/providers/types').TokenUsage | undefined
      let modelIdForSave = model.id
      let providerIdForSave = model.providerId

      if (imageModel) {
        const inputImages =
          (paramsSnapshot.input_images as string[] | undefined) ?? []
        const useInpaint = imageModel.fal_pipeline === 'kontext-lora-inpaint'
        const useEdit =
          !useInpaint &&
          (imageModel.model_type === 'image-to-image' ||
            (imageModel.support_edit && inputImages.length > 0))
        const pipeline = useInpaint
          ? runKontextLoraInpaint
          : useEdit
            ? runImageEdit
            : runTextToImage
        const r = await pipeline(imageModel, paramsSnapshot, {
          signal: controller.signal,
          onProgress: (p) => updateJob(jobId, { pct: p.pct, message: p.message }),
        })
        media = r.media
        modelIdForSave = useInpaint
          ? imageModel.fal_endpoint
          : useEdit
            ? (imageModel.fal_edit_endpoint ?? imageModel.fal_endpoint)
            : imageModel.fal_endpoint
        providerIdForSave = 'fal'
      } else {
        const r = await model.run(paramsSnapshot as never, {
          signal: controller.signal,
          onProgress: (p) => updateJob(jobId, { pct: p.pct, message: p.message }),
        })
        media = r.media
        text = r.text
        usage = r.usage
      }

      const ids: string[] = []
      if (model.kind === 'vision') {
        // Vision models return text, not media — single record per run.
        const rec = await saveGeneration({
          tabId,
          modelId: modelIdForSave,
          providerId: providerIdForSave,
          kind: 'vision',
          params: paramsSnapshot,
          media: [],
          text,
          usage,
        })
        ids.push(rec.id)
      } else {
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
      }

      markRun(tabId)
      stopRun()
      log.info('✅ run done', { jobId, savedRecords: ids.length })
      updateJob(jobId, {
        status: 'done',
        pct: 1,
        message: undefined,
        resultIds: ids,
        endedAt: Date.now(),
      })
      toast.success(`Done · ${job.modelName ?? 'job'}`)
    } catch (err) {
      stopRun()
      if (controller.signal.aborted) {
        log.warn('🟡 run cancelled', { jobId })
        updateJob(jobId, {
          status: 'cancelled',
          message: undefined,
          endedAt: Date.now(),
        })
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      log.error('❌ run failed', { jobId, msg, err })
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
