import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/app/routes'
import './styles/globals.css'

// Default to dark mode (a studio vibe)
if (!document.documentElement.classList.contains('dark')) {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster richColors position="bottom-right" theme="dark" />
  </StrictMode>,
)
