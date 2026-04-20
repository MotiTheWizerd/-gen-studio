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
    ...(model.fal_extra_input ?? {}),
    prompt,
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

  if (result.has_nsfw_concepts?.some((flag) => flag === true)) {
    log.warn('fal flagged NSFW on one or more images (delivered anyway)', {
      model: model.model_name,
      flags: result.has_nsfw_concepts,
    })
  }

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
  const sourceUris = rawImages.filter(
    (x): x is string =>
      typeof x === 'string' &&
      (x.startsWith('data:') || x.startsWith('http://') || x.startsWith('https://')),
  )
  if (sourceUris.length === 0) {
    throw new Error('At least one input image is required for editing')
  }

  const dataUriCount = sourceUris.filter((x) => x.startsWith('data:')).length
  const httpUriCount = sourceUris.length - dataUriCount

  log.info('runImageEdit start', {
    model: model.model_name,
    endpoint,
    images: sourceUris.length,
    dataUris: dataUriCount,
    httpUris: httpUriCount,
    promptChars: prompt.length,
    promptPreview: prompt.slice(0, 200),
  })

  ensureFalConfigured()

  if (dataUriCount > 0) {
    ctx.onProgress?.({ message: `uploading ${dataUriCount} image(s)…` })
  }
  const stopUpload = log.timer('prepare input images')
  const image_urls = await Promise.all(
    sourceUris.map(async (uri, i) => {
      if (!uri.startsWith('data:')) {
        log.info(`passthrough input #${i}`, { url: uri })
        return uri
      }
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

  const inputKey = model.fal_edit_input_key ?? 'image_urls'
  const input: Record<string, unknown> = {
    ...(model.fal_extra_input ?? {}),
    prompt,
  }
  if (inputKey === 'image_url') {
    input.image_url = image_urls[0]
    if (image_urls.length > 1) {
      log.warn(`${model.model_name} uses single image_url; ignoring ${image_urls.length - 1} extra image(s)`)
    }
  } else {
    input.image_urls = image_urls
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
    has_nsfw_concepts: result.has_nsfw_concepts,
  })

  if (result.has_nsfw_concepts?.some((flag) => flag === true)) {
    log.warn('fal flagged NSFW on one or more images (delivered anyway)', {
      model: model.model_name,
      flags: result.has_nsfw_concepts,
    })
  }

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

async function toBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri)
  if (!res.ok) throw new Error(`Failed to fetch ${uri}: ${res.status}`)
  return res.blob()
}

async function blobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('Failed to decode image for dimensions'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function makeWhiteMaskPng(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    )
  })
}

export async function runKontextLoraInpaint(
  model: ImageModel,
  params: Record<string, unknown>,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  const prompt = String(params.prompt ?? '').trim()
  if (!prompt) throw new Error('Prompt is required')

  const rawImages = (params.input_images as unknown[] | undefined) ?? []
  const sourceUris = rawImages.filter(
    (x): x is string =>
      typeof x === 'string' &&
      (x.startsWith('data:') || x.startsWith('http://') || x.startsWith('https://')),
  )
  if (sourceUris.length < 1) {
    throw new Error(
      `${model.model_name} needs at least one image (source). Add a second image to use it as the style reference.`,
    )
  }

  ensureFalConfigured()

  ctx.onProgress?.({ message: 'preparing source + reference + mask…' })
  const stopPrep = log.timer('inpaint prep')

  const sourceUri = sourceUris[0]
  const referenceUri = sourceUris[1] ?? sourceUris[0]
  const sourceBlobRaw = await toBlob(sourceUri)
  const sourceBlob = await compressImageForUpload(sourceBlobRaw)
  const { width, height } = await blobDimensions(sourceBlob)

  const userMask = typeof params.mask_url === 'string' ? params.mask_url : undefined
  const maskBlob = userMask
    ? await toBlob(userMask)
    : await makeWhiteMaskPng(width, height)
  const maskSource = userMask ? 'user-drawn' : 'auto-full-white'

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const [image_url, mask_url, reference_image_url] = await Promise.all([
    fal.storage.upload(sourceBlob),
    fal.storage.upload(maskBlob),
    referenceUri.startsWith('data:') || referenceUri.startsWith('blob:')
      ? toBlob(referenceUri)
          .then((b) => compressImageForUpload(b))
          .then((b) => fal.storage.upload(b))
      : Promise.resolve(referenceUri),
  ])
  stopPrep()
  log.info('inpaint uploads', {
    image_url,
    mask_url,
    maskSource,
    reference_image_url,
    sourceSize: { width, height },
  })

  const input: Record<string, unknown> = {
    ...(model.fal_extra_input ?? {}),
    prompt,
    image_url,
    mask_url,
    reference_image_url,
  }
  if (typeof params.seed === 'number') input.seed = params.seed
  if (typeof params.num_images === 'number') input.num_images = params.num_images
  input.strength =
    typeof params.strength === 'number' ? params.strength : 1
  if (Array.isArray(params.loras)) {
    const cleaned = (params.loras as Array<{ path?: unknown; scale?: unknown }>)
      .map((l) => ({
        path: typeof l.path === 'string' ? l.path.trim() : '',
        scale: typeof l.scale === 'number' ? l.scale : 1,
      }))
      .filter((l) => l.path.length > 0)
    if (cleaned.length > 0) input.loras = cleaned
  }

  ctx.onProgress?.({ message: `inpainting with ${model.model_name}…` })
  const stopInpaint = log.timer(`fal inpaint ${model.fal_endpoint}`)
  const result = await runImageModel(model, input, {
    signal: ctx.signal,
    onLog: (m) => ctx.onProgress?.({ message: m }),
  })
  stopInpaint()
  log.info('runKontextLoraInpaint result', {
    images: result.images.length,
    requestId: result.requestId,
    has_nsfw_concepts: result.has_nsfw_concepts,
  })

  if (result.has_nsfw_concepts?.some((flag) => flag === true)) {
    log.warn('fal flagged NSFW on one or more images (delivered anyway)', {
      model: model.model_name,
      flags: result.has_nsfw_concepts,
    })
  }

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const media = await Promise.all(
    result.images.map((img) => fetchAsBlob(img, ctx.signal)),
  )
  return { media, raw: result.raw }
}
