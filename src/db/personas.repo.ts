// Personas used to live in Dexie. They moved to the sidecar server — see
// src/lib/personaApi.ts. This file re-exports the API surface so existing
// callers that imported `@/db/personas.repo` keep compiling.

export {
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
  type Persona,
  type PersonaInput,
  type PersonaImage,
  type ImageSlot,
} from '@/lib/personaApi'
