import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

interface Props {
  sourceImage: string
  value: string | undefined
  onChange: (mask: string | undefined) => void
}

const MAX_DISPLAY_WIDTH = 512

export function MaskEditor({ sourceImage, value, onChange }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drawing = useRef(false)
  const [dispSize, setDispSize] = useState<{ w: number; h: number } | null>(null)
  const [brush, setBrush] = useState(60)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const scale = Math.min(1, MAX_DISPLAY_WIDTH / srcW)
      const dispW = Math.max(1, Math.round(srcW * scale))
      const dispH = Math.max(1, Math.round(srcH * scale))
      const mask = document.createElement('canvas')
      mask.width = srcW
      mask.height = srcH
      const mctx = mask.getContext('2d')
      if (!mctx) return
      mctx.fillStyle = '#000000'
      mctx.fillRect(0, 0, srcW, srcH)
      if (value) {
        const v = new Image()
        v.onload = () => {
          mctx.drawImage(v, 0, 0, srcW, srcH)
          maskRef.current = mask
          setDispSize({ w: dispW, h: dispH })
        }
        v.onerror = () => {
          maskRef.current = mask
          setDispSize({ w: dispW, h: dispH })
        }
        v.src = value
      } else {
        maskRef.current = mask
        setDispSize({ w: dispW, h: dispH })
      }
    }
    img.onerror = () => {
      /* source failed to load; editor stays blank */
    }
    img.src = sourceImage
  }, [sourceImage, value])

  useEffect(() => {
    repaint()
    // repaint intentionally has no deps — uses refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispSize])

  const repaint = () => {
    const d = displayRef.current
    const m = maskRef.current
    const s = imgRef.current
    if (!d || !m || !s || !dispSize) return
    const ctx = d.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, dispSize.w, dispSize.h)
    ctx.drawImage(s, 0, 0, dispSize.w, dispSize.h)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.55
    ctx.drawImage(m, 0, 0, dispSize.w, dispSize.h)
    ctx.restore()
  }

  const srcCoords = (e: React.PointerEvent) => {
    const d = displayRef.current
    const m = maskRef.current
    if (!d || !m) return null
    const rect = d.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    return { x: px * m.width, y: py * m.height }
  }

  const stroke = (e: React.PointerEvent) => {
    const m = maskRef.current
    const c = srcCoords(e)
    if (!m || !c) return
    const ctx = m.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(c.x, c.y, brush / 2, 0, Math.PI * 2)
    ctx.fill()
    repaint()
  }

  const commitMask = () => {
    const m = maskRef.current
    if (!m) return
    try {
      onChange(m.toDataURL('image/png'))
    } catch (err) {
      console.error('[MaskEditor] toDataURL failed (canvas may be CORS-tainted)', err)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    drawing.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    stroke(e)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return
    stroke(e)
  }
  const handlePointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    commitMask()
  }

  const clear = () => {
    const m = maskRef.current
    if (!m) return
    const ctx = m.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, m.width, m.height)
    repaint()
    onChange(undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Mask — paint regions to inpaint</Label>
      {dispSize ? (
        <canvas
          ref={displayRef}
          width={dispSize.w}
          height={dispSize.h}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="cursor-crosshair touch-none rounded border border-border"
          style={{ width: '100%', maxWidth: dispSize.w, height: 'auto' }}
        />
      ) : (
        <div className="text-xs text-muted-foreground">Loading source image…</div>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Brush size</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {brush}px
          </span>
        </div>
        <Slider
          min={10}
          max={300}
          step={5}
          value={[brush]}
          onValueChange={(v) => setBrush(v[0])}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clear}
        className="w-full justify-start"
      >
        <Eraser className="h-4 w-4" />
        Clear mask
      </Button>
    </div>
  )
}
