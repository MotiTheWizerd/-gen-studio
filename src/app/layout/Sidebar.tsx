import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wand2,
  Library,
  Plug,
  Settings,
  Image,
  Film,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUIStore } from '@/app/state/ui.store'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  match?: (pathname: string, search: string) => boolean
}

const items: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  {
    to: '/studio?task=image',
    label: 'Images',
    icon: Image,
    match: (p, s) =>
      p === '/studio' && new URLSearchParams(s).get('task') === 'image',
  },
  {
    to: '/studio?task=video',
    label: 'Videos',
    icon: Film,
    match: (p, s) =>
      p === '/studio' && new URLSearchParams(s).get('task') === 'video',
  },
  {
    to: '/studio',
    label: 'Studio',
    icon: Wand2,
    match: (p, s) => p === '/studio' && !new URLSearchParams(s).get('task'),
  },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/providers', label: 'Providers', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)

  return (
    <nav
      className={cn(
        'flex h-full flex-col gap-1',
        collapsed ? 'p-2' : 'p-3',
      )}
    >
      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'mb-1 flex items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          collapsed ? 'h-9 w-9 justify-center self-center' : 'h-8 gap-2 px-3',
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span className="text-xs">Collapse</span>
          </>
        )}
      </button>

      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = it.match
            ? it.match(location.pathname, location.search)
            : undefined
          const link = (
            <NavLink
              to={it.to}
              end
              className={({ isActive }) => {
                const on = active ?? isActive
                return cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed
                    ? 'h-9 w-9 justify-center'
                    : 'gap-3 px-3 py-2',
                  on
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }}
            >
              <it.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{it.label}</span>}
            </NavLink>
          )
          return (
            <li key={it.to} className={collapsed ? 'flex justify-center' : ''}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{it.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          )
        })}
      </ul>

      {!collapsed && (
        <div className="mt-auto rounded-md border bg-background/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Tip</p>
          <p className="mt-1 leading-snug">
            Open models as tabs in the Studio. Tabs persist across reloads.
          </p>
        </div>
      )}
    </nav>
  )
}
