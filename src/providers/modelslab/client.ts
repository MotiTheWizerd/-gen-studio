import { Client, Community } from 'modelslab'
import { env } from '@/lib/env'

let community: Community | null = null

export function getModelslabKey(): string {
  if (!env.MODELSLAB_KEY) {
    throw new Error('VITE_MODELSLAB_KEY is not set — add it to .env.local')
  }
  return env.MODELSLAB_KEY
}

export function ensureModelslabCommunity(): Community {
  if (community) return community
  const client = new Client(getModelslabKey())
  community = new Community(client.key)
  return community
}
