import { useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye as EyeIcon, Image as ImageIcon, Plus, Video as VideoIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { getModel, allModels } from '@/providers/registry'
import { useTabsStore, type GenTab } from '@/features/tabs/tabs.store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function TabPill({ tab }: { tab: GenTab }) {
  const activeId = useTabsStore((s) => s.activeId)
  const setActive = useTabsStore((s) => s.setActive)
  const close = useTabsStore((s) => s.close)
  const isActive = activeId === tab.id
  const model = getModel(tab.modelId)
  const Icon =
    model?.kind === 'video' ? VideoIcon : model?.kind === 'vision' ? EyeIcon : ImageIcon

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group relative flex h-9 min-w-[140px] max-w-[240px] items-center gap-2 rounded-t-md border border-b-0 px-3 text-sm transition-colors',
        isActive
          ? 'bg-background text-foreground'
          : 'border-transparent bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        isDragging && 'opacity-60',
      )}
      {...attributes}
      {...listeners}
      onMouseDown={(e) => {
        // middle-click closes, like a real browser
        if (e.button === 1) {
          e.preventDefault()
          close(tab.id)
        }
      }}
      onClick={() => setActive(tab.id)}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{tab.title}</span>
      <button
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation()
          close(tab.id)
        }}
        className={cn(
          'ml-auto flex h-5 w-5 items-center justify-center rounded opacity-0 transition-all hover:bg-muted group-hover:opacity-100',
          isActive && 'opacity-70',
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function NewTabMenu() {
  const open = useTabsStore((s) => s.open)
  const models = allModels()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="New tab"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>New tab</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.map((m) => {
          const Icon =
            m.kind === 'video' ? VideoIcon : m.kind === 'vision' ? EyeIcon : ImageIcon
          return (
            <DropdownMenuItem key={m.id} onSelect={() => open(m.id)}>
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex flex-col">
                <span>{m.label}</span>
                {m.description && (
                  <span className="text-xs text-muted-foreground">
                    {m.description}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const setActive = useTabsStore((s) => s.setActive)
  const close = useTabsStore((s) => s.close)
  const reorder = useTabsStore((s) => s.reorder)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Keyboard shortcuts: Ctrl/Cmd+W close, Ctrl+Tab next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'w' && activeId) {
        e.preventDefault()
        close(activeId)
      }
      if (mod && e.key === 'Tab' && tabs.length > 1) {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeId)
        const nextIdx = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length
        setActive(tabs[nextIdx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activeId, close, setActive])

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      reorder(String(active.id), String(over.id))
    }
  }

  return (
    <div className="flex items-end gap-1 border-b bg-card/30 px-2 pt-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={tabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-1 items-end gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <TabPill key={t.id} tab={t} />
            ))}
            {tabs.length === 0 && (
              <span className="px-2 pb-2 text-xs text-muted-foreground">
                No open tabs — click + to open a model
              </span>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <NewTabMenu />
    </div>
  )
}
