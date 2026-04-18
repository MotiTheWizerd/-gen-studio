import { fal } from '@fal-ai/client'
import { ensureFalConfigured } from '../images/fal'
import type { TokenUsage } from '../types'

export interface VisionRunInput {
  /** Image URLs OR data URIs (data URIs are uploaded to fal.storage first). */
  images: (string | Blob)[]
  prompt: string
  model: string
  system_prompt?: string
  temperature?: number
  max_tokens?: number
  reasoning?: boolean
}

export interface VisionRunResult {
  text: string
  usage?: TokenUsage
  requestId?: string
  raw: unknown
}

export interface VisionRunContext {
  signal: AbortSignal
  onProgress?: (p: { pct?: number; message?: string }) => void
}

async function toFalUrl(input: string | Blob, signal: AbortSignal): Promise<string> {
  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const blob = await (await fetch(input)).blob()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return fal.storage.upload(blob)
    }
    // Already an http(s) URL — pass through.
    return input
  }
  return fal.storage.upload(input)
}

export async function runVision(
  input: VisionRunInput,
  ctx: VisionRunContext,
): Promise<VisionRunResult> {
  ensureFalConfigured()

  if (input.images.length === 0) throw new Error('At least one image is required')
  if (!input.prompt.trim()) throw new Error('Prompt is required')
  if (!input.model.trim()) throw new Error('Model id is required')

  ctx.onProgress?.({ message: `uploading ${input.images.length} image(s)…` })
  const image_urls = await Promise.all(
    input.images.map((img) => toFalUrl(img, ctx.signal)),
  )

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const payload: Record<string, unknown> = {
    image_urls,
    prompt: input.prompt,
    model: input.model,
  }
  if (input.system_prompt) payload.system_prompt = input.system_prompt
  if (typeof input.temperature === 'number') payload.temperature = input.temperature
  if (typeof input.max_tokens === 'number') payload.max_tokens = input.max_tokens
  if (typeof input.reasoning === 'boolean') payload.reasoning = input.reasoning

  ctx.onProgress?.({ message: `calling ${input.model}…` })

  const result = await fal.subscribe('openrouter/router/vision', {
    input: payload,
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        for (const log of update.logs) ctx.onProgress?.({ message: log.message })
      }
    },
  })

  const data = result.data as
    | {
        output?: string
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          cost?: number
        }
      }
    | undefined

  return {
    text: data?.output ?? '',
    usage: data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          costUsd: data.usage.cost,
        }
      : undefined,
    requestId: result.requestId,
    raw: result,
  }
}
