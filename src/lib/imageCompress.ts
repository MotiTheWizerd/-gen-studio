import { createLogger } from './log'

const log = createLogger('img-compress')

interface Options {
  /** Longest-side cap in pixels. Default 2048. */
  maxSide?: number
  /** JPEG quality 0..1. Default 0.9. */
  quality?: number
  /** Skip compression if blob is already smaller than this. Default 800KB. */
  skipBelowBytes?: number
}

/**
 * Downscale + recompress an image blob for upload. Returns the original blob
 * if it's already small or if compression wouldn't help. JPEG output (PNG
 * transparency is not preserved — that's intentional, fal endpoints don't
 * need alpha for reference/edit inputs).
 */
export async function compressImageForUpload(
  blob: Blob,
  opts: Options = {},
): Promise<Blob> {
  const maxSide = opts.maxSide ?? 2048
  const quality = opts.quality ?? 0.9
  const skipBelowBytes = opts.skipBelowBytes ?? 800_000

  if (!blob.type.startsWith('image/')) return blob
  if (blob.size < skipBelowBytes) return blob

  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Failed to decode image'))
      i.src = url
    })

    const longSide = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = longSide > maxSide ? maxSide / longSide : 1
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(img, 0, 0, w, h)

    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })

    if (!out || out.size >= blob.size) {
      log.info('compression skipped (output not smaller)', {
        originalBytes: blob.size,
        outputBytes: out?.size ?? 0,
      })
      return blob
    }

    log.info('compressed', {
      from: `${img.naturalWidth}x${img.naturalHeight} ${blob.type} ${(blob.size / 1024).toFixed(0)}KB`,
      to: `${w}x${h} image/jpeg ${(out.size / 1024).toFixed(0)}KB`,
      reductionPct: Math.round((1 - out.size / blob.size) * 100),
    })
    return out
  } catch (err) {
    log.warn('compression failed, using original', err)
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
