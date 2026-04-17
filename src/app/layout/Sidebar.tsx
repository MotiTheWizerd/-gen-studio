import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wand2,
  Library,
  Plug,
  Settings,
  Image,
  Film,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

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
    match: (p, s) => p === '/studio' && new URLSearchParams(s).get('task') === 'image',
  },
  {
    to: '/studio?task=video',
    label: 'Videos',
    icon: Film,
    match: (p, s) => p === '/studio' && new URLSearchParams(s).get('task') === 'video',
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
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = it.match
            ? it.match(location.pathname, location.search)
            : undefined
          return (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end
                className={({ isActive }) => {
                  const on = active ?? isActive
                  return cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    on
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span>{it.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto rounded-md border bg-background/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Tip</p>
        <p className="mt-1 leading-snug">
          Open models as tabs in the Studio. Tabs persist across reloads.
        </p>
      </div>
    </nav>
  )
}
