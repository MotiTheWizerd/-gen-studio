import { Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getModel } from '@/providers/registry'
import { useTabsStore } from '@/features/tabs/tabs.store'
import { useJobsStore } from '../jobs.store'
import { useRunJob } from '../useRunJob'
import { ParamsPanel } from './ParamsPanel'
import { OutputCanvas } from './OutputCanvas'
import { JobHistoryStrip } from './JobHistoryStrip'

export function GenerationTab({ tabId }: { tabId: string }) {
  const tab = useTabsStore((s) => s.tabs.find((t) => t.id === tabId))
  const updateParams = useTabsStore((s) => s.updateParams)
  const job = useJobsStore((s) => s.byTab[tabId])
  const { run, cancel } = useRunJob(tabId)

  if (!tab) return null
  const model = getModel(tab.modelId)
  if (!model) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        Model not found: {tab.modelId}
      </div>
    )
  }

  const running = job?.status === 'running'

  return (
    <div className="grid h-full min-h-0 grid-cols-[360px_1fr]">
      <aside className="flex min-h-0 flex-col border-r bg-card/20">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{model.label}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {model.providerId} · {model.kind}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <ParamsPanel
              schema={model.paramSchema}
              values={tab.params}
              onChange={(patch) => updateParams(tabId, patch)}
            />
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          {running ? (
            <Button variant="destructive" className="w-full" onClick={cancel}>
              <Square className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button className="w-full" onClick={run}>
              {job?.status === 'done' ? (
                <Play className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run
            </Button>
          )}
          {job?.status === 'error' && (
            <p className="mt-2 text-xs text-destructive">{job.error}</p>
          )}
          {job?.status === 'running' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {job.message ?? 'working…'}
            </div>
          )}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <OutputCanvas tabId={tabId} />
        </div>
        <JobHistoryStrip tabId={tabId} />
      </section>
    </div>
  )
}
