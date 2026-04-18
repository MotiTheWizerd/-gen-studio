import { fal } from '@fal-ai/client'
import { runImageModel, type GeneratedImage } from './run'
import { ensureFalConfigured } from './fal'
import type { ImageModel } from './models'
import { createLogger } from '@/lib/log'
import { compressImageForUpload } from '@/lib/imageCompress'

const log = createLogger('image-pipeline')

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

  const input: Record<string, unknown> = {
    prompt,
    enable_safety_checker: false,
    safety_tolerance: '6',
  }
  if (typeof params.seed === 'number') input.seed = params.seed
  if (typeof params.num_images === 'number') input.num_images = params.num_images
  if (typeof params.aspect_ratio === 'string') input.aspect_ratio = params.aspect_ratio
  if (typeof params.image_size === 'string') input.image_size = params.image_size
  if (
    params.image_size &&
    typeof params.image_size === 'object' &&
    'width' in params.image_size &&
    'height' in params.image_size
  ) {
    input.image_size = params.image_size
  }

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

export async function runImageEdit(
  model: ImageModel,
  params: Record<string, unknown>,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  if (!model.support_edit) {
    throw new Error(`${model.model_name} does not support image editing`)
  }
  const endpoint = model.fal_edit_endpoint ?? model.fal_endpoint

  const prompt = String(params.prompt ?? '').trim()
  if (!prompt) throw new Error('Prompt is required')

  const rawImages = (params.input_images as unknown[] | undefined) ?? []
  const dataUris = rawImages.filter(
    (x): x is string => typeof x === 'string' && x.startsWith('data:'),
  )
  if (dataUris.length === 0) {
    throw new Error('At least one input image is required for editing')
  }

  log.info('runImageEdit start', {
    model: model.model_name,
    endpoint,
    images: dataUris.length,
    promptChars: prompt.length,
    promptPreview: prompt.slice(0, 200),
  })

  ensureFalConfigured()

  ctx.onProgress?.({ message: `uploading ${dataUris.length} image(s)…` })
  const stopUpload = log.timer('upload input images to fal.storage')
  const image_urls = await Promise.all(
    dataUris.map(async (uri, i) => {
      const rawBlob = await (await fetch(uri)).blob()
      if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const blob = await compressImageForUpload(rawBlob)
      if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const url = await fal.storage.upload(blob)
      log.info(`uploaded input #${i}`, {
        rawBytes: rawBlob.size,
        uploadedBytes: blob.size,
        mime: blob.type,
        url,
      })
      return url
    }),
  )
  stopUpload()

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const input: Record<string, unknown> = {
    prompt,
    image_urls,
    enable_safety_checker: false,
    safety_tolerance: '6',
  }
  if (typeof params.seed === 'number') input.seed = params.seed
  if (typeof params.num_images === 'number') input.num_images = params.num_images
  if (typeof params.aspect_ratio === 'string') input.aspect_ratio = params.aspect_ratio
  if (typeof params.image_size === 'string') input.image_size = params.image_size
  if (
    params.image_size &&
    typeof params.image_size === 'object' &&
    'width' in params.image_size &&
    'height' in params.image_size
  ) {
    input.image_size = params.image_size
  }

  ctx.onProgress?.({ message: `editing with ${model.model_name}…` })
  const stopEdit = log.timer(`fal edit ${endpoint}`)

  let result
  try {
    result = await runImageModel(model, input, {
      endpoint,
      signal: ctx.signal,
      onLog: (m) => {
        log.info(`fal log: ${m}`)
        ctx.onProgress?.({ message: m })
      },
    })
  } catch (err) {
    log.error('image-edit fal call failed', err)
    throw err
  }
  stopEdit()
  log.info('runImageEdit result', {
    images: result.images.length,
    requestId: result.requestId,
  })

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const stopFetch = log.timer('fetch generated images as blobs')
  const media = await Promise.all(
    result.images.map((img) => fetchAsBlob(img, ctx.signal)),
  )
  stopFetch()

  return { media, raw: result.raw }
}

// Back-compat alias
export const runImageToImage = runImageEdit
