import { nanoid } from 'nanoid'
import { db, type PersonaRecord } from './dexie'

export type PersonaInput = Pick<
  PersonaRecord,
  'name' | 'facial_details' | 'body_shape' | 'user_id'
>

export async function createPersona(input: PersonaInput): Promise<PersonaRecord> {
  const now = Date.now()
  const rec: PersonaRecord = {
    id: nanoid(),
    name: input.name,
    facial_details: input.facial_details,
    body_shape: input.body_shape,
    user_id: input.user_id,
    createdAt: now,
    updatedAt: now,
  }
  await db.personas.add(rec)
  return rec
}

export async function updatePersona(
  id: string,
  patch: Partial<PersonaInput>,
): Promise<void> {
  await db.personas.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deletePersona(id: string): Promise<void> {
  await db.personas.delete(id)
}

export async function getPersona(id: string): Promise<PersonaRecord | undefined> {
  return db.personas.get(id)
}

export async function listPersonas(): Promise<PersonaRecord[]> {
  return db.personas.orderBy('createdAt').reverse().toArray()
}
