/**
 * Curated list of ModelsLab models. Grow the `MODELSLAB_MODEL_IDS` tuple
 * with each new id (it drives both the zod enum + dropdown order — the
 * first entry is the default).
 *
 * Different ModelsLab models live behind different API surfaces:
 *  - `v6-community`: the long-standing Community API (text2img / img2img),
 *    accepts width/height/steps/guidance/safety_checker, has async polling.
 *  - `v7-text-to-image`: newer provider-hosted models like Alibaba's Wan.
 *    Documents only `prompt` as required. Minimal body; no i2i.
 */
export type ModelslabApiVersion = 'v6-community' | 'v7-text-to-image'

export const MODELSLAB_MODEL_IDS = ['flux-klein', 'wan-2.7-t2i'] as const
export type ModelslabModelId = (typeof MODELSLAB_MODEL_IDS)[number]

export interface ModelslabModel {
  id: ModelslabModelId
  api: ModelslabApiVersion
  /** If false/undefined, the run() will reject input_images with a clear error. */
  supportsI2I?: boolean
}

export const MODELSLAB_MODELS: readonly ModelslabModel[] = [
  { id: 'flux-klein', api: 'v6-community', supportsI2I: true },
  // Explicit false so ParamsPanel hides the upload button for this model.
  // Undefined would be treated as "unknown → assume supported" (permissive).
  { id: 'wan-2.7-t2i', api: 'v7-text-to-image', supportsI2I: false },
]

export function getModelslabModel(id: string): ModelslabModel | undefined {
  return MODELSLAB_MODELS.find((m) => m.id === id)
}
