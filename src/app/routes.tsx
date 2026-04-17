import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { StudioPage } from '@/features/generation/StudioPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { ProvidersPage } from '@/features/providers/ProvidersPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/studio" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'studio', element: <StudioPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'providers', element: <ProvidersPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
