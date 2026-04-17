import { fal } from '@fal-ai/client'
import { ensureFalConfigured } from './fal'
import type { ImageModel } from './models'

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
}

export async function runImageModel(
  model: ImageModel,
  input: Record<string, unknown>,
  options: RunImageOptions = {},
): Promise<RunImageResult> {
  ensureFalConfigured()

  const result = await fal.subscribe(model.fal_endpoint, {
    input,
    logs: options.logs ?? true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS' && options.onLog) {
        for (const log of update.logs) options.onLog(log.message)
      }
    },
  })

  const data = result.data as
    | { images?: GeneratedImage[]; description?: string }
    | undefined

  return {
    images: data?.images ?? [],
    description: data?.description,
    requestId: result.requestId,
    raw: result,
  }
}
