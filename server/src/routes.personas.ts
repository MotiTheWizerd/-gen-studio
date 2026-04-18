import { Hono } from 'hono'
import { pool } from './db.js'
import { errorResp } from './errors.js'
import {
  VALID_SLOTS,
  deletePersonaDir,
  deleteSlotFile,
  mimeToExt,
  readImagesFor,
  writeSlotFile,
  type ImageSlot,
} from './persona-images.js'
import { config } from './config.js'

type PersonaRow = {
  id: string
  user_id: string
  name: string
  facial_details: string
  body_shape: string
  created_at: Date | string
  updated_at: Date | string
}

function toPersona(r: PersonaRow) {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    facial_details: r.facial_details,
    body_shape: r.body_shape,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  }
}

export const personasRoutes = new Hono()

personasRoutes.get('/', async (c) => {
  const userId = c.req.query('user_id') ?? 'default'
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200)
  const { rows } = await pool.query<PersonaRow>(
    'SELECT * FROM personas WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit],
  )
  const personas = await Promise.all(
    rows.map(async (r) => ({ ...toPersona(r), images: await readImagesFor(r.id, r.user_id) })),
  )
  return c.json({ personas, next_cursor: null })
})

personasRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { user_id?: string; name?: string; facial_details?: string; body_shape?: string }
    | null
  if (!body || !body.name || !body.name.trim()) {
    return errorResp(c, 400, 'validation_failed', 'name is required')
  }
  const userId = body.user_id ?? 'default'
  const { rows } = await pool.query<PersonaRow>(
    `INSERT INTO personas(user_id, name, facial_details, body_shape)
     VALUES($1, $2, $3, $4) RETURNING *`,
    [userId, body.name.trim(), body.facial_details ?? '', body.body_shape ?? ''],
  )
  return c.json({ ...toPersona(rows[0]), images: [] }, 201)
})

personasRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const { rows } = await pool.query<PersonaRow>('SELECT * FROM personas WHERE id=$1', [id])
  if (!rows[0]) return errorResp(c, 404, 'persona_not_found', `Persona ${id} not found`)
  return c.json({ ...toPersona(rows[0]), images: await readImagesFor(rows[0].id, rows[0].user_id) })
})

personasRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return errorResp(c, 400, 'validation_failed', 'invalid body')

  const sets: string[] = []
  const values: unknown[] = []
  for (const k of ['name', 'facial_details', 'body_shape'] as const) {
    if (typeof body[k] === 'string') {
      values.push(body[k])
      sets.push(`${k} = $${values.length}`)
    }
  }
  if (!sets.length) return errorResp(c, 400, 'validation_failed', 'nothing to update')
  values.push(id)
  const { rows } = await pool.query<PersonaRow>(
    `UPDATE personas SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values,
  )
  if (!rows[0]) return errorResp(c, 404, 'persona_not_found', `Persona ${id} not found`)
  return c.json({ ...toPersona(rows[0]), images: await readImagesFor(rows[0].id, rows[0].user_id) })
})

personasRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const { rows } = await pool.query<{ user_id: string }>(
    'DELETE FROM personas WHERE id=$1 RETURNING user_id',
    [id],
  )
  if (!rows[0]) return errorResp(c, 404, 'persona_not_found', `Persona ${id} not found`)
  await deletePersonaDir(rows[0].user_id, id)
  return c.body(null, 204)
})

personasRoutes.put('/:id/images/:slot', async (c) => {
  const id = c.req.param('id')
  const slot = c.req.param('slot') as ImageSlot
  if (!(VALID_SLOTS as readonly string[]).includes(slot)) {
    return errorResp(c, 400, 'invalid_slot', `Invalid slot: ${slot}`)
  }

  const { rows: personaRows } = await pool.query<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM personas WHERE id=$1',
    [id],
  )
  const persona = personaRows[0]
  if (!persona) return errorResp(c, 404, 'persona_not_found', `Persona ${id} not found`)

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return errorResp(c, 400, 'validation_failed', 'expected multipart/form-data')
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return errorResp(c, 400, 'validation_failed', "'file' field is required")
  }
  if (file.size > config.maxUploadBytes) {
    return errorResp(c, 413, 'file_too_large', `Max ${config.maxUploadBytes} bytes`)
  }
  const mime = file.type
  const ext = mimeToExt(mime)
  if (!ext) return errorResp(c, 400, 'unsupported_media_type', `Unsupported mime: ${mime}`)

  const buf = Buffer.from(await file.arrayBuffer())
  const filename = await writeSlotFile(persona.user_id, id, slot, ext, buf)

  const now = new Date()
  await pool.query(
    `INSERT INTO persona_images(persona_id, slot, filename, mime, width, height, bytes, updated_at)
     VALUES($1,$2,$3,$4,0,0,$5,$6)
     ON CONFLICT (persona_id, slot) DO UPDATE SET
       filename = EXCLUDED.filename,
       mime = EXCLUDED.mime,
       bytes = EXCLUDED.bytes,
       updated_at = EXCLUDED.updated_at`,
    [id, slot, filename, mime, buf.length, now],
  )
  await pool.query('UPDATE personas SET updated_at = NOW() WHERE id = $1', [id])

  const images = await readImagesFor(id, persona.user_id)
  const entry = images.find((i) => i.slot === slot)
  return c.json(entry)
})

personasRoutes.delete('/:id/images/:slot', async (c) => {
  const id = c.req.param('id')
  const slot = c.req.param('slot') as ImageSlot
  if (!(VALID_SLOTS as readonly string[]).includes(slot)) {
    return errorResp(c, 400, 'invalid_slot', `Invalid slot: ${slot}`)
  }

  const { rows: personaRows } = await pool.query<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM personas WHERE id=$1',
    [id],
  )
  const persona = personaRows[0]
  if (!persona) return errorResp(c, 404, 'persona_not_found', `Persona ${id} not found`)

  const { rows } = await pool.query<{ filename: string }>(
    'DELETE FROM persona_images WHERE persona_id=$1 AND slot=$2 RETURNING filename',
    [id, slot],
  )
  if (rows[0]) await deleteSlotFile(persona.user_id, id, rows[0].filename)
  await pool.query('UPDATE personas SET updated_at = NOW() WHERE id = $1', [id])
  return c.body(null, 204)
})
