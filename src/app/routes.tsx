import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from './layout/AppShell'
import { StudioPage } from '@/features/generation/StudioPage'

// Keep Studio in the main bundle (it's the default landing page, so it
// should be instantly interactive). Everything else is code-split.
const HomePage = lazy(() =>
  import('@/features/home/HomePage').then((m) => ({ default: m.HomePage })),
)
const LibraryPage = lazy(() =>
  import('@/features/library/LibraryPage').then((m) => ({ default: m.LibraryPage })),
)
const CharactersPage = lazy(() =>
  import('@/features/characters/CharactersPage').then((m) => ({
    default: m.CharactersPage,
  })),
)
const PersonaEditor = lazy(() =>
  import('@/features/characters/PersonaEditor').then((m) => ({
    default: m.PersonaEditor,
  })),
)
const ProvidersPage = lazy(() =>
  import('@/features/providers/ProvidersPage').then((m) => ({
    default: m.ProvidersPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading…
    </div>
  )
}

function wrap(Node: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{Node}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/studio" replace /> },
      { path: 'home', element: wrap(<HomePage />) },
      { path: 'studio', element: <StudioPage /> },
      { path: 'library', element: wrap(<LibraryPage />) },
      { path: 'characters', element: wrap(<CharactersPage />) },
      { path: 'characters/new', element: wrap(<PersonaEditor />) },
      { path: 'characters/:id', element: wrap(<PersonaEditor />) },
      { path: 'providers', element: wrap(<ProvidersPage />) },
      { path: 'settings', element: wrap(<SettingsPage />) },
    ],
  },
])
