import { nanoid } from 'nanoid'
import { db, type GenerationRecord } from './dexie'

export async function saveGeneration(
  input: Omit<GenerationRecord, 'id' | 'createdAt' | 'starred'>,
): Promise<GenerationRecord> {
  const rec: GenerationRecord = {
    ...input,
    id: nanoid(),
    createdAt: Date.now(),
    starred: 0,
  }
  await db.generations.add(rec)
  return rec
}

export async function deleteGeneration(id: string) {
  await db.generations.delete(id)
}

export async function toggleStar(id: string) {
  const rec = await db.generations.get(id)
  if (!rec) return
  await db.generations.update(id, { starred: rec.starred ? 0 : 1 })
}

export async function listByTab(tabId: string): Promise<GenerationRecord[]> {
  return db.generations
    .where('tabId')
    .equals(tabId)
    .reverse()
    .sortBy('createdAt')
}
