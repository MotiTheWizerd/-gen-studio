import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type GenerationRecord } from '@/db/dexie'
import { cn } from '@/lib/cn'

interface Props {
  tabId: string
}

export function JobHistoryStrip({ tabId }: Props) {
  const rows = useLiveQuery(
    () =>
      db.generations
        .where('tabId')
        .equals(tabId)
        .reverse()
        .sortBy('createdAt')
        .then((r) => r.slice(0, 12)),
    [tabId],
  )

  if (!rows || rows.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-t bg-card/40 px-3 py-2">
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
        history
      </span>
      {rows.map((r) => (
        <Thumb key={r.id} rec={r} />
      ))}
    </div>
  )
}

function Thumb({ rec }: { rec: GenerationRecord }) {
  const blob = rec.media[0]?.blob
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const label = useMemo(() => {
    const p = (rec.params as { prompt?: string }).prompt
    return p ? p.slice(0, 60) : rec.modelId
  }, [rec])

  return (
    <div
      title={label}
      className={cn(
        'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted',
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover no-drag" />
      ) : null}
    </div>
  )
}
