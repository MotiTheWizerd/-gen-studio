import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useShallow } from 'zustand/react/shallow'
import { Download, Loader2, Trash2, Star } from 'lucide-react'
import { db, type GenerationRecord } from '@/db/dexie'
import { deleteGeneration, toggleStar } from '@/db/generations.repo'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useJobsStore, type JobState } from '../jobs.store'

interface Props {
  tabId: string
}

export function OutputCanvas({ tabId }: Props) {
  const runningJobs = useJobsStore(
    useShallow((s) =>
      (s.byTab[tabId] ?? []).filter((j) => j.status === 'running'),
    ),
  )
  const rows =
    useLiveQuery(
      () =>
        db.generations
          .where('tabId')
          .equals(tabId)
          .reverse()
          .sortBy('createdAt'),
      [tabId],
    ) ?? []

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const empty = rows.length === 0 && runningJobs.length === 0

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {empty ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...runningJobs].reverse().map((j) => (
              <SkeletonTile key={j.id} job={j} />
            ))}
            {rows.map((r, i) => (
              <GalleryTile
                key={r.id}
                rec={r}
                onOpen={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
      <ImageLightbox
        items={rows}
        openIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </ScrollArea>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <div className="text-sm">Nothing here yet</div>
      <div className="text-xs">
        Fill in the params and hit{' '}
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Run</kbd>
      </div>
    </div>
  )
}

function SkeletonTile({ job }: { job: JobState }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted-foreground/10 to-muted" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <div className="line-clamp-2 max-w-[90%] px-2 text-center text-[10px]">
          {job.message ?? 'generating…'}
        </div>
      </div>
      {job.modelName && (
        <div className="absolute bottom-2 left-2 right-2 truncate text-[10px] uppercase tracking-widest text-muted-foreground/80">
          {job.modelName}
        </div>
      )}
    </div>
  )
}

function GalleryTile({
  rec,
  onOpen,
}: {
  rec: GenerationRecord
  onOpen: () => void
}) {
  const blob = rec.media[0]?.blob
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const isVideo = rec.kind === 'video' && blob?.type.startsWith('video/')
  const prompt = String((rec.params as { prompt?: string }).prompt ?? rec.modelId)

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${rec.modelId.replace(/\//g, '-')}-${rec.id}.${ext(rec.media[0]?.mime ?? 'image/png')}`
    a.click()
  }

  return (
    <div
      className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-lg border bg-muted"
      onClick={onOpen}
    >
      {url ? (
        isVideo ? (
          <video
            src={url}
            muted
            loop
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => e.currentTarget.pause()}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover no-drag"
          />
        )
      ) : null}

      {rec.starred === 1 && (
        <div className="absolute left-2 top-2 rounded-full bg-background/70 p-1 shadow-sm backdrop-blur">
          <Star className="h-3 w-3 fill-current text-primary" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="line-clamp-2 text-xs text-white/90">{prompt}</div>
        <div className="mt-1.5 flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              toggleStar(rec.id)
            }}
          >
            <Star
              className={`h-3.5 w-3.5 ${rec.starred ? 'fill-current' : ''}`}
            />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              download()
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="pointer-events-auto h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              deleteGeneration(rec.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ext(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'bin'
}
