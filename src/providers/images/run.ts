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
      inputSummary[k] = `[${v.length} items]`
    } else {
      inputSummary[k] = v
    }
  }
  log.info('fal.subscribe ▶', { endpoint, input: inputSummary })

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
    log.error('fal.subscribe ✗ rejected', {
      endpoint,
      err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    throw err
  }

  const data = result.data as
    | { images?: GeneratedImage[]; description?: string }
    | undefined

  log.info('fal.subscribe ✓ resolved', {
    endpoint,
    requestId: result.requestId,
    imageCount: data?.images?.length ?? 0,
    hasDescription: typeof data?.description === 'string',
  })

  return {
    images: data?.images ?? [],
    description: data?.description,
    requestId: result.requestId,
    raw: result,
  }
}
