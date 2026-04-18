import fs from 'node:fs'
import path from 'node:path'
import { pool } from './db.js'
import { config } from './config.js'

export const VALID_SLOTS = ['face', 'body', 'ref_1', 'ref_2', 'ref_3'] as const
export type ImageSlot = (typeof VALID_SLOTS)[number]

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}

export function mimeToExt(mime: string): string | null {
  return MIME_EXT[mime.toLowerCase()] ?? null
}

export function personaDir(userId: string, personaId: string): string {
  return path.join(config.dataRoot, 'users', userId, 'personas', personaId)
}

export function imageUrl(userId: string, personaId: string, filename: string): string {
  return `${config.publicBaseUrl}/static/users/${userId}/personas/${personaId}/${filename}`
}

export type PersonaImageRow = {
  slot: ImageSlot
  filename: string
  mime: string
  width: number
  height: number
  bytes: number
  updated_at: Date | string
}

export async function readImagesFor(personaId: string, userId: string) {
  const { rows } = await pool.query<PersonaImageRow>(
    `SELECT slot, filename, mime, width, height, bytes, updated_at
     FROM persona_images
     WHERE persona_id = $1
     ORDER BY slot`,
    [personaId],
  )
  return rows.map((r) => ({
    slot: r.slot,
    url: imageUrl(userId, personaId, r.filename),
    mime: r.mime,
    width: r.width,
    height: r.height,
    bytes: Number(r.bytes),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  }))
}

export async function writeSlotFile(
  userId: string,
  personaId: string,
  slot: ImageSlot,
  ext: string,
  buf: Buffer,
): Promise<string> {
  const dir = personaDir(userId, personaId)
  await fs.promises.mkdir(dir, { recursive: true })

  // Remove any prior file(s) at this slot, regardless of extension.
  const existing = await fs.promises.readdir(dir).catch(() => [])
  for (const f of existing) {
    if (f.startsWith(`${slot}.`)) {
      await fs.promises.unlink(path.join(dir, f)).catch(() => undefined)
    }
  }

  const filename = `${slot}.${ext}`
  const filepath = path.join(dir, filename)
  const tmp = `${filepath}.tmp`
  await fs.promises.writeFile(tmp, buf)
  await fs.promises.rename(tmp, filepath)
  return filename
}

export async function deleteSlotFile(
  userId: string,
  personaId: string,
  filename: string,
): Promise<void> {
  const fp = path.join(personaDir(userId, personaId), filename)
  await fs.promises.unlink(fp).catch(() => undefined)
}

export async function deletePersonaDir(userId: string, personaId: string): Promise<void> {
  await fs.promises.rm(personaDir(userId, personaId), { recursive: true, force: true }).catch(
    () => undefined,
  )
}
