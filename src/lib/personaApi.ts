import { useEffect, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787/api/v1'

export const IMAGE_SLOTS = ['face', 'body', 'ref_1', 'ref_2', 'ref_3'] as const
export type ImageSlot = (typeof IMAGE_SLOTS)[number]

export interface PersonaImage {
  slot: ImageSlot
  url: string
  mime: string
  width: number
  height: number
  bytes: number
  updated_at: string
}

export interface Persona {
  id: string
  user_id: string
  name: string
  facial_details: string
  body_shape: string
  images: PersonaImage[]
  created_at: string
  updated_at: string
}

export interface PersonaInput {
  name: string
  facial_details?: string
  body_shape?: string
  user_id?: string
}

interface ApiError {
  error: { code: string; message: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body as ApiError | null)?.error
    throw new Error(err?.message ?? `${res.status} ${res.statusText}`)
  }
  return body as T
}

// ---- CRUD ----

export async function listPersonas(userId = 'default'): Promise<Persona[]> {
  const { personas } = await request<{ personas: Persona[] }>(
    `/personas?user_id=${encodeURIComponent(userId)}`,
  )
  return personas
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  try {
    return await request<Persona>(`/personas/${id}`)
  } catch {
    return undefined
  }
}

export async function createPersona(input: PersonaInput): Promise<Persona> {
  const persona = await request<Persona>('/personas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'default', ...input }),
  })
  invalidate()
  return persona
}

export async function updatePersona(
  id: string,
  patch: Partial<Pick<Persona, 'name' | 'facial_details' | 'body_shape'>>,
): Promise<Persona> {
  const persona = await request<Persona>(`/personas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  invalidate()
  return persona
}

export async function deletePersona(id: string): Promise<void> {
  await request<void>(`/personas/${id}`, { method: 'DELETE' })
  invalidate()
}

// ---- Image slots ----

export async function uploadPersonaImage(
  id: string,
  slot: ImageSlot,
  file: Blob,
): Promise<PersonaImage> {
  const form = new FormData()
  form.append('file', file, `${slot}.${extFromMime(file.type)}`)
  const image = await request<PersonaImage>(`/personas/${id}/images/${slot}`, {
    method: 'PUT',
    body: form,
  })
  invalidate()
  return image
}

export async function deletePersonaImage(id: string, slot: ImageSlot): Promise<void> {
  await request<void>(`/personas/${id}/images/${slot}`, { method: 'DELETE' })
  invalidate()
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

// ---- Reactive cache ----
//
// The server is the source of truth. We keep a single in-memory list and
// notify subscribed hooks whenever any mutation runs. Simpler than wiring
// a full query cache, and good enough for a single-user desktop app.

let cache: Persona[] | null = null
let inflight: Promise<Persona[]> | null = null
const listeners = new Set<() => void>()

async function refresh(): Promise<Persona[]> {
  if (inflight) return inflight
  inflight = listPersonas()
    .then((rows) => {
      cache = rows
      for (const l of listeners) l()
      return rows
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function invalidate() {
  void refresh()
}

export function usePersonas(): Persona[] | null {
  const [state, setState] = useState<Persona[] | null>(cache)
  useEffect(() => {
    const update = () => setState(cache)
    listeners.add(update)
    if (cache === null) void refresh()
    else setState(cache)
    return () => {
      listeners.delete(update)
    }
  }, [])
  return state
}

export function usePersona(id: string | undefined): {
  persona: Persona | null
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [persona, setPersona] = useState<Persona | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!id) {
      setPersona(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getPersona(id)
      .then((p) => {
        if (cancelled) return
        setPersona(p ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, tick])

  return { persona, loading, error, reload: () => setTick((t) => t + 1) }
}
