import Dexie, { type Table } from 'dexie'
import type { MediaKind } from '@/providers/types'

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
  kind: MediaKind
  params: Record<string, unknown>
  media: StoredMedia[]
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
  }
}

export const db = new VibeDB()
