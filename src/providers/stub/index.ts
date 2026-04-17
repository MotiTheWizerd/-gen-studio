import { z } from 'zod'
import type { Model, Provider } from '../types'

/**
 * Stub provider — draws a placeholder image / generates a blank video blob
 * so the full pipeline (params → run → save → render) can be exercised
 * without real API keys.
 */

const imageSchema = z.object({
  prompt: z.string().min(1).describe('Prompt'),
  width: z.number().int().min(64).max(2048).default(1024).describe('Width'),
  height: z.number().int().min(64).max(2048).default(1024).describe('Height'),
  steps: z.number().int().min(1).max(50).default(20).describe('Steps'),
  seed: z.number().int().optional().describe('Seed (optional)'),
})
type ImageParams = z.infer<typeof imageSchema>

const videoSchema = z.object({
  prompt: z.string().min(1).describe('Prompt'),
  duration: z.number().min(1).max(10).default(3).describe('Duration (seconds)'),
  fps: z.number().int().min(8).max(30).default(24).describe('FPS'),
})
type VideoParams = z.infer<typeof videoSchema>

async function drawPlaceholderImage(params: ImageParams): Promise<Blob> {
  const { width, height, prompt } = params
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // gradient background derived from prompt hash
  const hash = [...prompt].reduce((a, c) => a + c.charCodeAt(0), 0)
  const h1 = hash % 360
  const h2 = (h1 + 60) % 360
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, `hsl(${h1} 80% 55%)`)
  grad.addColorStop(1, `hsl(${h2} 80% 35%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // noise
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1)
  }
  ctx.globalAlpha = 1

  // prompt text
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `bold ${Math.max(16, Math.floor(width / 28))}px Inter, sans-serif`
  ctx.textBaseline = 'top'
  wrapText(ctx, prompt, 32, 32, width - 64, Math.floor(width / 22))

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.font = `${Math.max(11, Math.floor(width / 64))}px Inter, sans-serif`
  ctx.fillText(`stub · ${width}×${height}`, 32, height - 40)

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y)
}

async function drawPlaceholderVideo(params: VideoParams): Promise<Blob> {
  // Lightweight placeholder: render first frame as image, wrap as "video" blob
  // with video/* mime so the OutputCanvas flags it correctly. Real providers
  // return actual mp4 bytes.
  const frame = await drawPlaceholderImage({
    prompt: `${params.prompt}\n(stub video ${params.duration}s @ ${params.fps}fps)`,
    width: 1024,
    height: 576,
    steps: 1,
  })
  return new Blob([await frame.arrayBuffer()], { type: 'image/png' })
}

const stubImage: Model<ImageParams> = {
  id: 'stub/image',
  providerId: 'stub',
  kind: 'image',
  label: 'Stub Image',
  description: 'Local placeholder image for testing the pipeline',
  paramSchema: imageSchema,
  defaults: { prompt: 'a neon dreamscape', width: 1024, height: 1024, steps: 20 },
  run: async (params, { signal, onProgress }) => {
    for (let i = 0; i < 5; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      onProgress?.({ pct: (i + 1) / 5, message: `sketching frame ${i + 1}/5` })
      await new Promise((r) => setTimeout(r, 180))
    }
    const blob = await drawPlaceholderImage(params)
    return {
      media: [{ kind: 'image', blob, mime: 'image/png' }],
      raw: { params },
    }
  },
}

const stubVideo: Model<VideoParams> = {
  id: 'stub/video',
  providerId: 'stub',
  kind: 'video',
  label: 'Stub Video',
  description: 'Local placeholder video for testing the pipeline',
  paramSchema: videoSchema,
  defaults: { prompt: 'a drone flying over a city at night', duration: 3, fps: 24 },
  run: async (params, { signal, onProgress }) => {
    const steps = 8
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      onProgress?.({ pct: (i + 1) / steps, message: `rendering ${i + 1}/${steps}` })
      await new Promise((r) => setTimeout(r, 220))
    }
    const blob = await drawPlaceholderVideo(params)
    return { media: [{ kind: 'video', blob, mime: blob.type }], raw: { params } }
  },
}

export const stubProvider: Provider = {
  id: 'stub',
  label: 'Stub (local)',
  kinds: ['image', 'video'],
  isConfigured: () => true,
  setupHint: 'No key required — runs locally to test the pipeline.',
  models: [stubImage, stubVideo],
}
