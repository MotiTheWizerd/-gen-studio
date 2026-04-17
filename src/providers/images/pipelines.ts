import { runImageModel, type GeneratedImage } from './run'
import type { ImageModel } from './models'

export interface PipelineMedia {
  kind: 'image'
  blob: Blob
  mime: string
  width?: number
  height?: number
}

export interface PipelineResult {
  media: PipelineMedia[]
  raw: unknown
}

export interface PipelineContext {
  signal: AbortSignal
  onProgress?: (p: { pct?: number; message?: string }) => void
}

async function fetchAsBlob(img: GeneratedImage, signal: AbortSignal) {
  const res = await fetch(img.url, { signal })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const blob = await res.blob()
  return {
    kind: 'image' as const,
    blob,
    mime: img.content_type ?? blob.type ?? 'image/png',
    width: img.width,
    height: img.height,
  }
}

export async function runTextToImage(
  model: ImageModel,
  params: Record<string, unknown>,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  if (model.model_type !== 'text-to-image') {
    throw new Error(`${model.model_name} is not a text-to-image model`)
  }

  const prompt = String(params.prompt ?? '').trim()
  if (!prompt) throw new Error('Prompt is required')

  const input: Record<string, unknown> = { prompt }
  if (typeof params.seed === 'number') input.seed = params.seed
  if (typeof params.num_images === 'number') input.num_images = params.num_images
  if (typeof params.aspect_ratio === 'string') input.aspect_ratio = params.aspect_ratio

  ctx.onProgress?.({ message: `calling ${model.model_name}…` })

  const result = await runImageModel(model, input, {
    onLog: (m) => ctx.onProgress?.({ message: m }),
  })

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const media = await Promise.all(
    result.images.map((img) => fetchAsBlob(img, ctx.signal)),
  )

  return { media, raw: result.raw }
}

export async function runImageToImage(
  _model: ImageModel,
  _params: Record<string, unknown>,
  _ctx: PipelineContext,
): Promise<PipelineResult> {
  throw new Error('image-to-image pipeline not implemented yet')
}
