import { useCallback, useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Star,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GenerationRecord } from '@/db/dexie'
import { deleteGeneration, toggleStar } from '@/db/generations.repo'
import { acquireBlobUrl, releaseBlobUrl } from '@/lib/blob-url-cache'

interface Props {
  items: GenerationRecord[]
  openIndex: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}

export function ImageLightbox({
  items,
  openIndex,
  onClose,
  onIndexChange,
}: Props) {
  const open = openIndex !== null
  const rec = open ? items[openIndex] : null

  const go = useCallback(
    (delta: number) => {
      if (openIndex === null || items.length === 0) return
      const next = (openIndex + delta + items.length) % items.length
      onIndexChange(next)
    },
    [openIndex, items.length, onIndexChange],
  )

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, go])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={(e) => {
            // click on backdrop area (the Content itself) closes
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {rec
              ? String(
                  (rec.params as { prompt?: string }).prompt ?? rec.modelId,
                )
              : 'Image'}
          </DialogPrimitive.Title>

          {rec && <LightboxMedia rec={rec} />}

          <DialogPrimitive.Close asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-4 rounded-full shadow-md"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>

          {items.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  go(-1)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full shadow-md"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  go(1)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full shadow-md"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {rec && openIndex !== null && (
            <LightboxFooter
              rec={rec}
              index={openIndex}
              total={items.length}
              onClose={onClose}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function LightboxMedia({ rec }: { rec: GenerationRecord }) {
  const blob = rec.media[0]?.blob
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    setUrl(acquireBlobUrl(rec.id, blob))
    return () => releaseBlobUrl(rec.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.id])

  if (!url) return null
  const isVideo = rec.kind === 'video' && blob?.type.startsWith('video/')
  return isVideo ? (
    <video
      src={url}
      controls
      autoPlay
      className="max-h-[92vh] max-w-[92vw] rounded-lg shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  ) : (
    <img
      src={url}
      alt=""
      className="max-h-[92vh] max-w-[92vw] rounded-lg shadow-2xl no-drag"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function LightboxFooter({
  rec,
  index,
  total,
  onClose,
}: {
  rec: GenerationRecord
  index: number
  total: number
  onClose: () => void
}) {
  const blob = rec.media[0]?.blob
  const prompt = String(
    (rec.params as { prompt?: string }).prompt ?? rec.modelId,
  )

  const download = () => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = `${rec.modelId.replace(/\//g, '-')}-${rec.id}`
    a.click()
    URL.revokeObjectURL(u)
  }

  return (
    <div
      className="absolute bottom-4 left-1/2 max-w-[92vw] -translate-x-1/2 rounded-lg border bg-background/80 px-4 py-3 shadow-lg backdrop-blur"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="line-clamp-2 text-xs text-muted-foreground">{prompt}</div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          size="sm"
          variant={rec.starred ? 'default' : 'outline'}
          onClick={() => toggleStar(rec.id)}
        >
          <Star className={`h-3.5 w-3.5 ${rec.starred ? 'fill-current' : ''}`} />
          {rec.starred ? 'Starred' : 'Star'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            deleteGeneration(rec.id)
            onClose()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          {index + 1} / {total}
        </div>
      </div>
    </div>
  )
}
