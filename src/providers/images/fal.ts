import { fal } from '@fal-ai/client'
import { env } from '@/lib/env'

let configured = false

export function ensureFalConfigured(): void {
  if (configured) return
  if (!env.FAL_KEY) {
    throw new Error('VITE_FAL_KEY is not set — add it to .env.local')
  }
  fal.config({ credentials: env.FAL_KEY })
  configured = true
}
