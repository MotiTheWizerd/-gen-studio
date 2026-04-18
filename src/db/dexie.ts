import Dexie, { type Table } from 'dexie'
import type { MediaKind, ModelKind, TokenUsage } from '@/providers/types'

export interface StoredMedia {
  kind: MediaKind
  blob: Blob
  mime: string
  width?: number
  height?: number
  durationMs?: number
}

export interface GenerationRecord {
  id: string
  tabId: string | null
  modelId: string
  providerId: string
  kind: ModelKind
  params: Record<string, unknown>
  /** Empty for vision-kind records. */
  media: StoredMedia[]
  /** Populated for vision-kind records — the model's textual response. */
  text?: string
  usage?: TokenUsage
  createdAt: number
  starred: 0 | 1
}

export class VibeDB extends Dexie {
  generations!: Table<GenerationRecord, string>

  constructor() {
    super('vibe-studio')
    this.version(1).stores({
      // Indexed fields only; blobs live on the row itself.
      generations: 'id, tabId, modelId, providerId, kind, createdAt, starred',
    })
    this.version(2).stores({
      generations: 'id, tabId, modelId, providerId, kind, createdAt, starred',
      personas: 'id, name, createdAt, updatedAt, user_id',
    })
    // v3: personas moved out of Dexie — the sidecar server + Postgres is the
    // source of truth now (see src/lib/personaApi.ts). Drop the store.
    this.version(3).stores({
      generations: 'id, tabId, modelId, providerId, kind, createdAt, starred',
      personas: null,
    })
  }
}

export const db = new VibeDB()
