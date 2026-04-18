import { z } from 'zod'
import type { Model, Provider } from '../types'
import { env } from '@/lib/env'
import { runVision } from './pipelines'

/**
 * Vision provider — wraps fal's `openrouter/router/vision` endpoint, which
 * routes to any underlying VLM (Gemini, Claude, GPT, Grok, Qwen, …).
 *
 * Models here take one or more input images plus a text prompt and return
 * a textual response (caption / analysis / OCR / Q&A). No media output.
 */

const visionSchema = z.object({
  prompt: z.string().min(1).describe('Prompt'),
  input_images: z
    .array(z.string())
    .min(1)
    .describe('Input images (data URIs or URLs)'),
  model: z
    .string()
    .default('google/gemini-2.5-flash')
    .describe('Underlying VLM (OpenRouter id)'),
  system_prompt: z.string().optional().describe('System prompt'),
  temperature: z.number().min(0).max(2).default(1).describe('Temperature'),
  max_tokens: z.number().int().optional().describe('Max output tokens'),
  reasoning: z.boolean().default(false).describe('Include reasoning'),
})
type VisionParams = z.infer<typeof visionSchema>

const openrouterVision: Model<VisionParams> = {
  id: 'openrouter/router/vision',
  providerId: 'vision',
  kind: 'vision',
  label: 'OpenRouter Vision',
  description: 'Any VLM via fal — Gemini, Claude, GPT, Grok, Qwen, Pixtral…',
  paramSchema: visionSchema,
  defaults: {
    prompt: 'Describe this image in detail.',
    input_images: [],
    model: 'google/gemini-2.5-flash',
    temperature: 1,
    reasoning: false,
  },
  run: async (params, ctx) => {
    const r = await runVision(
      {
        images: params.input_images,
        prompt: params.prompt,
        model: params.model,
        system_prompt: params.system_prompt,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        reasoning: params.reasoning,
      },
      ctx,
    )
    return { media: [], text: r.text, usage: r.usage, raw: r.raw }
  },
}

export const visionProvider: Provider = {
  id: 'vision',
  label: 'Vision (fal · OpenRouter)',
  kinds: ['vision'],
  isConfigured: () => Boolean(env.FAL_KEY),
  setupHint: 'Add VITE_FAL_KEY to .env.local — same key as the image models.',
  models: [openrouterVision],
}

/** OpenRouter model ids exposed in pickers. Charge-by-token, choose freely. */
export const VISION_MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (cheap, fast)' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'Qwen3-VL 235B' },
  { id: 'x-ai/grok-4-fast', label: 'Grok-4 Fast' },
] as const

export { runVision } from './pipelines'
export type { VisionRunInput, VisionRunResult } from './pipelines'
