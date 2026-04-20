import { fal } from '@fal-ai/client'
import { ensureFalConfigured } from './fal'
import type { ImageModel } from './models'
import { createLogger } from '@/lib/log'

const log = createLogger('image-run')

export interface GeneratedImage {
  url: string
  file_name?: string
  content_type?: string
  width?: number
  height?: number
}

export interface RunImageResult {
  images: GeneratedImage[]
  description?: string
  requestId?: string
  has_nsfw_concepts?: boolean[]
  raw: unknown
}

export interface RunImageOptions {
  logs?: boolean
  onLog?: (message: string) => void
  endpoint?: string
  signal?: AbortSignal
}

export async function runImageModel(
  model: ImageModel,
  input: Record<string, unknown>,
  options: RunImageOptions = {},
): Promise<RunImageResult> {
  ensureFalConfigured()

  const endpoint = options.endpoint ?? model.fal_endpoint

  const inputSummary: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') {
      inputSummary[k] = v.length > 200 ? `${v.slice(0, 200)}…(${v.length})` : v
    } else if (Array.isArray(v)) {
      inputSummary[k] = v.every((x) => typeof x === 'string')
        ? v
        : `[${v.length} items]`
    } else {
      inputSummary[k] = v
    }
  }
  log.info('fal.subscribe ▶', {
    endpoint,
    inputKeys: Object.keys(input),
    input: inputSummary,
  })

  let result
  try {
    result = await fal.subscribe(endpoint, {
      input,
      logs: options.logs ?? true,
      abortSignal: options.signal,
      onQueueUpdate: (update) => {
        log.info(`queue: ${update.status}`, {
          position: 'queue_position' in update ? update.queue_position : undefined,
          requestId: 'request_id' in update ? update.request_id : undefined,
        })
        if (update.status === 'IN_PROGRESS' && options.onLog) {
          for (const l of update.logs) {
            log.info(`fal log: ${l.message}`)
            options.onLog(l.message)
          }
        }
      },
    })
  } catch (err) {
    const e = err as {
      status?: number
      body?: unknown
      response?: { status?: number; statusText?: string; body?: unknown }
      message?: string
      stack?: string
    }
    let responseBodyText: string | undefined
    try {
      const resp = (err as { response?: Response }).response
      if (resp && typeof (resp as Response).clone === 'function') {
        responseBodyText = await (resp as Response).clone().text()
      }
    } catch {
      /* ignore */
    }
    const bodyForLog = e.body ?? responseBodyText
    const bodyString =
      typeof bodyForLog === 'string'
        ? bodyForLog
        : (() => {
            try {
              return JSON.stringify(bodyForLog, null, 2)
            } catch {
              return String(bodyForLog)
            }
          })()
    log.error('fal.subscribe ✗ rejected', {
      endpoint,
      inputKeys: Object.keys(input),
      inputPreview: (() => {
        try {
          return JSON.stringify(input, (_k, v) => (typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…(${v.length})` : v))
        } catch {
          return '[unserializable]'
        }
      })(),
      status: e.status ?? e.response?.status,
      statusText: e.response?.statusText,
      bodyString,
      message: err instanceof Error ? err.message : String(err),
      errName: err instanceof Error ? err.name : undefined,
    })
    console.error('[vibe][image-run] full error body:\n' + bodyString)
    throw err
  }

  const data = result.data as
    | {
        images?: GeneratedImage[]
        description?: string
        has_nsfw_concepts?: boolean[]
      }
    | undefined

  log.info('fal.subscribe ✓ resolved', {
    endpoint,
    requestId: result.requestId,
    imageCount: data?.images?.length ?? 0,
    hasDescription: typeof data?.description === 'string',
    has_nsfw_concepts: data?.has_nsfw_concepts,
  })

  return {
    images: data?.images ?? [],
    description: data?.description,
    requestId: result.requestId,
    has_nsfw_concepts: data?.has_nsfw_concepts,
    raw: result,
  }
}
