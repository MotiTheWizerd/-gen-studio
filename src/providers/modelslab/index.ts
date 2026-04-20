import { z } from 'zod'
import type { Model, Provider } from '../types'
import { env } from '@/lib/env'
import { MODELSLAB_MODEL_IDS, getModelslabModel } from './models'
import {
  runModelslabT2I,
  runModelslabI2I,
  type ModelslabT2IParams,
  type ModelslabI2IParams,
} from './pipelines'

const imageSchema = z.object({
  prompt: z.string().min(1).describe('Prompt'),
  negative_prompt: z.string().optional().describe('Negative prompt'),
  model_id: z
    .enum(MODELSLAB_MODEL_IDS)
    .default(MODELSLAB_MODEL_IDS[0])
    .describe('Model'),
  image_size: z.string().default('square_hd').describe('Image size'),
  samples: z.number().int().min(1).max(4).default(1).describe('Samples'),
  num_inference_steps: z.number().int().min(10).max(50).default(30).describe('Inference steps'),
  guidance_scale: z.number().min(0).max(20).multipleOf(0.5).default(7.5).describe('Guidance scale'),
  strength: z.number().min(0).max(1).multipleOf(0.05).default(0.7).describe('Strength (image-to-image only)'),
  seed: z.number().int().optional().describe('Seed (optional)'),
})
type ImageParams = z.infer<typeof imageSchema>

/**
 * Single modelslab image model. Auto-routes text-to-image vs image-to-image
 * based on whether the tab has any attached `input_images[]` — matching the
 * fal shell's UX (pick model once, add images to switch modes).
 *
 * `input_images` is NOT in the zod schema (like fal) — it's managed by
 * ParamsPanel's upload button + GenerationTab's thumbnail strip, which key
 * off `modelKind === 'image'` directly.
 */
const modelslabImage: Model<ImageParams> = {
  id: 'modelslab/image',
  providerId: 'modelslab',
  kind: 'image',
  label: 'ModelsLab · Image',
  description: 'Community text-to-image / image-to-image (flux / sdxl / etc.)',
  paramSchema: imageSchema,
  defaults: {
    prompt: 'A neon dreamscape at dusk, cinematic lighting',
    model_id: MODELSLAB_MODEL_IDS[0],
    image_size: 'square_hd',
    samples: 1,
    num_inference_steps: 30,
    guidance_scale: 7.5,
    strength: 0.7,
  },
  run: async (params, ctx) => {
    const inputImages = (params as unknown as { input_images?: unknown })
      .input_images
    const initImage =
      Array.isArray(inputImages) && typeof inputImages[0] === 'string'
        ? inputImages[0]
        : undefined

    // Only fall back to t2i when the model EXPLICITLY declares
    // supportsI2I: false. Unknown / legacy ids try i2i (so existing
    // flux-klein tabs with attached images keep working).
    const meta = getModelslabModel(params.model_id)
    const modelSupportsI2I = meta?.supportsI2I !== false

    if (initImage && initImage.length > 0 && modelSupportsI2I) {
      const i2iParams: ModelslabI2IParams = { ...params, init_image: initImage }
      const r = await runModelslabI2I(i2iParams, ctx)
      return { media: r.media, raw: r.raw }
    }
    const t2iParams: ModelslabT2IParams = params
    const r = await runModelslabT2I(t2iParams, ctx)
    return { media: r.media, raw: r.raw }
  },
}

export const modelslabProvider: Provider = {
  id: 'modelslab',
  label: 'ModelsLab',
  kinds: ['image'],
  isConfigured: () => Boolean(env.MODELSLAB_KEY),
  setupHint: 'Add VITE_MODELSLAB_KEY to .env.local',
  models: [modelslabImage],
}

export { runModelslabT2I, runModelslabI2I }
export type { ModelslabT2IParams, ModelslabI2IParams }
