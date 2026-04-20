import { createLogger } from '@/lib/log'
import type { MediaResult, RunContext } from '../types'
import { ensureModelslabCommunity, getModelslabKey } from './client'
import { uploadBase64ToUrl } from './upload'
import { getModelslabModel } from './models'

const log = createLogger('modelslab-pipeline')

const V6_FETCH_URL = 'https://modelslab.com/api/v6/images/fetch'
const V7_T2I_URL = 'https://modelslab.com/api/v7/images/text-to-image'
// Fetch path for v7 is not documented — mirrors v6 convention. If polling
// 404s, the error body will surface the URL we tried so we can fix.
const V7_FETCH_URL = 'https://modelslab.com/api/v7/images/fetch'

interface CommonParams {
  prompt: string
  negative_prompt?: string
  model_id: string
  image_size?: string
  width?: number
  height?: number
  samples?: number
  num_inference_steps?: number
  guidance_scale?: number
  seed?: number
}

const IMAGE_SIZE_MAP: Record<string, { width: number; height: number }> = {
  square_hd: { width: 1024, height: 1024 },
  square: { width: 512, height: 512 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1024, height: 576 },
}

function resolveSize(params: CommonParams): { width?: number; height?: number } {
  if (params.image_size && IMAGE_SIZE_MAP[params.image_size]) {
    return IMAGE_SIZE_MAP[params.image_size]
  }
  // Fallback: legacy tabs that still have numeric width/height.
  return { width: params.width, height: params.height }
}

export type ModelslabT2IParams = CommonParams

export interface ModelslabI2IParams extends CommonParams {
  init_image: string
  strength?: number
}

interface ApiResponse {
  status?: 'success' | 'processing' | 'error' | 'failed'
  id?: number | string
  output?: string[] | string
  eta?: number
  message?: string
  /** modelslab typo for `message` — they return this field name on failures. */
  messege?: string
  tip?: string
}

function extractMessage(r: ApiResponse): string {
  return r.message ?? r.messege ?? 'unknown'
}

export interface PipelineResult {
  media: MediaResult[]
  raw: unknown
}

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 60

function roundTo8(n: number): number {
  return Math.max(64, Math.round(n / 8) * 8)
}

async function pollForResult(
  fetchBase: string,
  id: number,
  ctx: RunContext,
  initialEtaSeconds?: number,
): Promise<ApiResponse> {
  const url = `${fetchBase}/${id}`
  // Respect the server's eta hint for the first wait so we don't hit the
  // fetch endpoint before the job's even started cooking.
  const firstWaitMs = Math.max(
    POLL_INTERVAL_MS,
    typeof initialEtaSeconds === 'number' ? initialEtaSeconds * 1000 : 0,
  )
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    const waitMs = attempt === 1 ? firstWaitMs : POLL_INTERVAL_MS
    if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    await new Promise((r) => setTimeout(r, waitMs))
    if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: getModelslabKey() }),
      signal: ctx.signal,
    })
    const text = await res.text()
    const bodyPreview = text.slice(0, 400)

    if (!res.ok) {
      log.error('poll: HTTP error (aborting)', {
        attempt,
        httpStatus: res.status,
        url,
        bodyPreview,
      })
      throw new Error(
        `modelslab poll ${url} returned ${res.status}: ${bodyPreview}`,
      )
    }

    let data: ApiResponse
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      log.error('poll: non-JSON response (aborting)', {
        attempt,
        httpStatus: res.status,
        url,
        bodyPreview,
      })
      throw new Error(
        `modelslab poll ${url} returned non-JSON: ${bodyPreview}`,
      )
    }

    log.info('poll response', {
      attempt,
      httpStatus: res.status,
      apiStatus: data.status,
      hasOutput: Array.isArray(data.output) && data.output.length > 0,
      message: data.message,
    })

    if (data.status === 'success') return data
    const msg = extractMessage(data)
    // "Try Again" is modelslab's "not ready yet, keep polling" — NOT a
    // real failure even though they label it status=failed.
    const isTryAgain =
      (data.status === 'failed' || data.status === 'error') &&
      /try\s*again/i.test(msg)
    if ((data.status === 'error' || data.status === 'failed') && !isTryAgain) {
      throw new Error(`modelslab polling failed: ${msg}`)
    }
    // Unknown / unexpected status — bail after 3 attempts so we don't loop
    // silently on something like {} or a field we haven't seen yet.
    if (
      data.status !== 'processing' &&
      !isTryAgain &&
      attempt >= 3
    ) {
      log.error('poll: unknown status (aborting)', {
        attempt,
        url,
        bodyPreview,
      })
      throw new Error(
        `modelslab poll ${url}: unknown status "${data.status}". Body: ${bodyPreview}`,
      )
    }
    ctx.onProgress?.({
      message: `processing… (attempt ${attempt}/${POLL_MAX_ATTEMPTS})`,
    })
  }
  throw new Error('modelslab: timed out waiting for result')
}

async function resolveOutput(
  initial: ApiResponse,
  fetchBase: string,
  ctx: RunContext,
): Promise<string[]> {
  if (initial.status === 'error' || initial.status === 'failed') {
    throw new Error(`modelslab error: ${extractMessage(initial)}`)
  }
  let resp = initial
  if (resp.status === 'processing' && resp.id != null) {
    ctx.onProgress?.({ message: `queued (eta ${resp.eta ?? '?'}s)…` })
    resp = await pollForResult(fetchBase, Number(resp.id), ctx, resp.eta)
  }
  if (resp.status !== 'success') {
    throw new Error(`modelslab: no output (status=${resp.status})`)
  }
  const outputs = Array.isArray(resp.output)
    ? resp.output
    : typeof resp.output === 'string' && resp.output.length > 0
      ? [resp.output]
      : []
  if (outputs.length === 0) {
    throw new Error(`modelslab: empty output field`)
  }
  return outputs
}

async function fetchAsMedia(
  url: string,
  signal: AbortSignal,
): Promise<MediaResult> {
  // modelslab (especially v7) sometimes returns a `status: success` with a
  // predicted R2 URL before the object is actually written. Retry 404s with
  // backoff so we wait for the upload to land. Other errors fail fast.
  const MAX_ATTEMPTS = 10
  const RETRY_MS = 3000
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const res = await fetch(url, { signal })
    if (res.ok) {
      const blob = await res.blob()
      const dims = await probeImageDimensions(blob).catch(() => undefined)
      return {
        kind: 'image',
        blob,
        mime: blob.type || 'image/png',
        width: dims?.width,
        height: dims?.height,
      }
    }
    if (res.status !== 404) {
      throw new Error(`failed to fetch ${url}: ${res.status}`)
    }
    if (attempt === MAX_ATTEMPTS) break
    log.warn(`output URL 404, waiting for upload (${attempt}/${MAX_ATTEMPTS})`, { url })
    await new Promise((r) => setTimeout(r, RETRY_MS))
  }
  throw new Error(`failed to fetch ${url}: 404 after ${MAX_ATTEMPTS} attempts`)
}

async function probeImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function buildV6Body(params: CommonParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    key: getModelslabKey(),
    prompt: params.prompt,
    model_id: params.model_id,
    safety_checker: 'no',
  }
  if (params.negative_prompt) body.negative_prompt = params.negative_prompt
  const { width, height } = resolveSize(params)
  if (typeof width === 'number') body.width = roundTo8(width)
  if (typeof height === 'number') body.height = roundTo8(height)
  if (typeof params.samples === 'number') body.samples = params.samples
  if (typeof params.num_inference_steps === 'number') body.num_inference_steps = params.num_inference_steps
  if (typeof params.guidance_scale === 'number') body.guidance_scale = params.guidance_scale
  if (typeof params.seed === 'number') body.seed = params.seed
  return body
}

export async function runModelslabT2I(
  params: ModelslabT2IParams,
  ctx: RunContext,
): Promise<PipelineResult> {
  const meta = getModelslabModel(params.model_id)
  const api = meta?.api ?? 'v6-community'

  if (api === 'v7-text-to-image') return runV7T2I(params, ctx)

  const community = ensureModelslabCommunity()
  const body = buildV6Body(params)
  const promptStr = String(body.prompt ?? '')
  log.info('v6 text2img ▶', {
    model_id: params.model_id,
    size: `${body.width ?? '?'}×${body.height ?? '?'}`,
    samples: params.samples,
    promptChars: promptStr.length,
    promptPreview: promptStr.slice(0, 300),
    bodyKeys: Object.keys(body).filter((k) => k !== 'key'),
  })
  ctx.onProgress?.({ message: `calling modelslab ${params.model_id}…` })

  const resp = (await community.textToImage(body as never)) as ApiResponse
  log.info('v6 text2img initial', { status: resp.status, id: resp.id, eta: resp.eta })
  const urls = await resolveOutput(resp, V6_FETCH_URL, ctx)
  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const media = await Promise.all(urls.map((u) => fetchAsMedia(u, ctx.signal)))
  return { media, raw: resp }
}

export async function runModelslabI2I(
  params: ModelslabI2IParams,
  ctx: RunContext,
): Promise<PipelineResult> {
  const meta = getModelslabModel(params.model_id)
  if (meta && !meta.supportsI2I) {
    throw new Error(
      `${params.model_id} does not support image-to-image. Remove the attached image or pick a different model.`,
    )
  }
  if (!params.init_image) {
    throw new Error('init_image is required for img2img')
  }

  const community = ensureModelslabCommunity()
  ctx.onProgress?.({ message: 'preparing source image…' })
  const init_image = await uploadBase64ToUrl(params.init_image, ctx.signal)
  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const body = {
    ...buildV6Body(params),
    init_image,
    ...(typeof params.strength === 'number' ? { strength: params.strength } : {}),
  }
  log.info('v6 img2img ▶', {
    model_id: params.model_id,
    init_image,
    strength: params.strength,
  })
  ctx.onProgress?.({ message: `calling modelslab ${params.model_id}…` })

  const resp = (await community.imageToImage(body as never)) as ApiResponse
  log.info('v6 img2img initial', { status: resp.status, id: resp.id, eta: resp.eta })
  const urls = await resolveOutput(resp, V6_FETCH_URL, ctx)
  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const media = await Promise.all(urls.map((u) => fetchAsMedia(u, ctx.signal)))
  return { media, raw: resp }
}

async function runV7T2I(
  params: ModelslabT2IParams,
  ctx: RunContext,
): Promise<PipelineResult> {
  // v7 only documents `prompt` as required; skip all the v6 knobs so we
  // don't risk rejection on an unknown field. Grow this once specific
  // models are verified to accept more parameters.
  const body: Record<string, unknown> = {
    key: getModelslabKey(),
    model_id: params.model_id,
    prompt: params.prompt,
  }
  if (params.negative_prompt) body.negative_prompt = params.negative_prompt

  log.info('v7 text-to-image ▶', { model_id: params.model_id })
  ctx.onProgress?.({ message: `calling modelslab ${params.model_id}…` })

  const res = await fetch(V7_T2I_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ctx.signal,
  })
  const text = await res.text()
  let resp: ApiResponse
  try {
    resp = text ? JSON.parse(text) : {}
  } catch {
    log.error('v7: non-JSON response', { status: res.status, body: text.slice(0, 400) })
    throw new Error(`modelslab v7 returned non-JSON (status ${res.status})`)
  }
  if (!res.ok) {
    log.error('v7 submit failed', { status: res.status, body: resp })
    throw new Error(
      `modelslab v7: ${resp.message ?? `status ${res.status}`}`,
    )
  }
  log.info('v7 initial', { status: resp.status, id: resp.id, eta: resp.eta })

  const urls = await resolveOutput(resp, V7_FETCH_URL, ctx)
  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const media = await Promise.all(urls.map((u) => fetchAsMedia(u, ctx.signal)))
  return { media, raw: resp }
}
