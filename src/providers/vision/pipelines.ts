import { fal } from '@fal-ai/client'
import { ensureFalConfigured } from '../images/fal'
import type { TokenUsage } from '../types'
import { createLogger } from '@/lib/log'
import { compressImageForUpload } from '@/lib/imageCompress'

const log = createLogger('vision')

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
  /** fal.storage URLs for any Blob/data-URI inputs — http(s) inputs pass through. */
  imageUrls: string[]
  usage?: TokenUsage
  requestId?: string
  raw: unknown
}

export interface VisionRunContext {
  signal: AbortSignal
  onProgress?: (p: { pct?: number; message?: string }) => void
}

async function toFalUrl(input: string | Blob, signal: AbortSignal): Promise<string> {
  let blob: Blob
  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      blob = await (await fetch(input)).blob()
    } else {
      // Already an http(s) URL — pass through.
      return input
    }
  } else {
    blob = input
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const compressed = await compressImageForUpload(blob)
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return fal.storage.upload(compressed)
}

export async function runVision(
  input: VisionRunInput,
  ctx: VisionRunContext,
): Promise<VisionRunResult> {
  ensureFalConfigured()

  if (input.images.length === 0) throw new Error('At least one image is required')
  if (!input.prompt.trim()) throw new Error('Prompt is required')
  if (!input.model.trim()) throw new Error('Model id is required')

  log.info('runVision start', {
    model: input.model,
    images: input.images.length,
    promptChars: input.prompt.length,
  })

  ctx.onProgress?.({ message: `uploading ${input.images.length} image(s)…` })
  const stopUpload = log.timer('upload images to fal.storage')
  const image_urls = await Promise.all(
    input.images.map((img) => toFalUrl(img, ctx.signal)),
  )
  stopUpload()
  log.info('upload complete', { urls: image_urls.length })

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const payload = {
    image_urls,
    prompt: input.prompt,
    model: input.model,
    ...(input.system_prompt ? { system_prompt: input.system_prompt } : {}),
    ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
    ...(typeof input.max_tokens === 'number' ? { max_tokens: input.max_tokens } : {}),
    ...(typeof input.reasoning === 'boolean' ? { reasoning: input.reasoning } : {}),
  }

  ctx.onProgress?.({ message: `calling ${input.model}…` })
  const stopSubscribe = log.timer(`fal.subscribe openrouter/router/vision (${input.model})`)

  const result = await fal.subscribe('openrouter/router/vision', {
    input: payload,
    logs: true,
    abortSignal: ctx.signal,
    onQueueUpdate: (update) => {
      log.info(`queue update: ${update.status}`, {
        position: 'queue_position' in update ? update.queue_position : undefined,
      })
      if (update.status === 'IN_PROGRESS') {
        for (const l of update.logs) {
          log.info(`fal log: ${l.message}`)
          ctx.onProgress?.({ message: l.message })
        }
      }
    },
  })

  stopSubscribe()
  log.info('runVision result', {
    requestId: result.requestId,
    hasOutput: typeof (result.data as { output?: string })?.output === 'string',
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
    imageUrls: image_urls,
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
