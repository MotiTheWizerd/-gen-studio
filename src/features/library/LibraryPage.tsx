import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Star, Trash2, Download } from 'lucide-react'
import { db, type GenerationRecord } from '@/db/dexie'
import { deleteGeneration, toggleStar } from '@/db/generations.repo'
import { Button } from '@/components/ui/button'

export function LibraryPage() {
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'starred'>(
    'all',
  )
  const rows = useLiveQuery(
    () => db.generations.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const filtered = (rows ?? []).filter((r) => {
    if (filter === 'all') return true
    if (filter === 'starred') return r.starred === 1
    return r.kind === filter
  })

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {rows?.length ?? 0} generations
            </p>
          </div>
          <div className="flex gap-1">
            {(['all', 'image', 'video', 'starred'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-24 text-center text-sm text-muted-foreground">
            No generations yet — go create something in the Studio.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((r) => (
              <LibraryCard key={r.id} rec={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LibraryCard({ rec }: { rec: GenerationRecord }) {
  const blob = rec.media[0]?.blob
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const isVideo = rec.kind === 'video' && blob?.type.startsWith('video/')

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted">
      <div className="aspect-square bg-black/20">
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
            <img src={url} alt="" className="h-full w-full object-cover no-drag" />
          )
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="line-clamp-2 text-xs text-white">
          {String((rec.params as { prompt?: string }).prompt ?? rec.modelId)}
        </div>
        <div className="mt-2 flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto h-7 w-7"
            onClick={() => toggleStar(rec.id)}
          >
            <Star className={`h-3.5 w-3.5 ${rec.starred ? 'fill-current' : ''}`} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto h-7 w-7"
            onClick={() => {
              if (!url) return
              const a = document.createElement('a')
              a.href = url
              a.download = `${rec.modelId.replace('/', '-')}-${rec.id}`
              a.click()
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="pointer-events-auto h-7 w-7"
            onClick={() => deleteGeneration(rec.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
