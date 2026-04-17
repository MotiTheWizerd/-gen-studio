import { Outlet, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { TabBar } from './TabBar'

export function AppShell() {
  const location = useLocation()
  const showTabs = location.pathname.startsWith('/studio')

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid h-full w-full grid-cols-[240px_1fr] grid-rows-[56px_1fr] bg-background">
        <div className="col-span-2 row-start-1 row-end-2">
          <Header />
        </div>
        <aside className="col-start-1 col-end-2 row-start-2 row-end-3 border-r bg-card/40">
          <Sidebar />
        </aside>
        <main className="col-start-2 col-end-3 row-start-2 row-end-3 flex min-h-0 min-w-0 flex-col">
          {showTabs && <TabBar />}
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
