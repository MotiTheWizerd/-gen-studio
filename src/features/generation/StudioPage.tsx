import { useTabsStore } from '@/features/tabs/tabs.store'
import { GenerationTab } from './components/GenerationTab'
import { allModels } from '@/providers/registry'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon, Video as VideoIcon, Eye as EyeIcon } from 'lucide-react'

export function StudioPage() {
  const activeId = useTabsStore((s) => s.activeId)
  const tabs = useTabsStore((s) => s.tabs)
  const open = useTabsStore((s) => s.open)

  const active = tabs.find((t) => t.id === activeId)
  if (active) return <GenerationTab key={active.id} tabId={active.id} />

  // Empty state — pick a model to open your first tab
  const models = allModels()
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Open your first tab
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each tab is an independent generation session. Pick a model to start.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          {models.map((m) => {
            const Icon =
              m.kind === 'video' ? VideoIcon : m.kind === 'vision' ? EyeIcon : ImageIcon
            return (
              <Button
                key={m.id}
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3"
                onClick={() => open(m.id)}
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="flex flex-col text-left">
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.description ?? `${m.providerId} · ${m.kind}`}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
