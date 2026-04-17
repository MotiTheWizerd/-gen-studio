import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Loader2, Trash2, Star } from 'lucide-react'
import { db } from '@/db/dexie'
import { deleteGeneration, toggleStar } from '@/db/generations.repo'
import { Button } from '@/components/ui/button'
import { useJobsStore } from '../jobs.store'

interface Props {
  tabId: string
}

export function OutputCanvas({ tabId }: Props) {
  const job = useJobsStore((s) => s.byTab[tabId])
  const latest = useLiveQuery(
    () =>
      db.generations
        .where('tabId')
        .equals(tabId)
        .reverse()
        .sortBy('createdAt')
        .then((rows) => rows[0] ?? null),
    [tabId],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {job?.status === 'running' ? (
          <RunningOverlay pct={job.pct} message={job.message} />
        ) : latest ? (
          <MediaView key={latest.id} recId={latest.id} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function RunningOverlay({ pct, message }: { pct?: number; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <div className="text-sm">{message ?? 'working…'}</div>
      {pct !== undefined && (
        <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
      <div className="text-sm">Nothing here yet</div>
      <div className="text-xs">
        Fill in the params and hit <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Run</kbd>
      </div>
    </div>
  )
}

function MediaView({ recId }: { recId: string }) {
  const rec = useLiveQuery(() => db.generations.get(recId), [recId])
  const [url, setUrl] = useState<string | null>(null)

  const blob = useMemo(() => rec?.media[0]?.blob, [rec])
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  if (!rec || !url || !blob) return null
  const media = rec.media[0]
  const isVideo = media.kind === 'video' && media.mime.startsWith('video/')

  const download = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = `${rec.modelId.replace('/', '-')}-${rec.id}.${ext(media.mime)}`
    a.click()
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            loop
            className="max-h-full max-w-full rounded-lg border shadow-lg"
          />
        ) : (
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full rounded-lg border shadow-lg no-drag"
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          size="sm"
          variant={rec.starred ? 'default' : 'outline'}
          onClick={() => toggleStar(rec.id)}
        >
          <Star
            className={`h-3.5 w-3.5 ${rec.starred ? 'fill-current' : ''}`}
          />
          {rec.starred ? 'Starred' : 'Star'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => deleteGeneration(rec.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
