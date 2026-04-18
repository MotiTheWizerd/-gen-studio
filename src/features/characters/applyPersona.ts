import { getPersona } from '@/db/personas.repo'

export type GenerationMode = 'standard' | 'persona_replacement'

/**
 * If the params declare persona_replacement mode + a persona_id, look up the
 * persona and prepend its descriptors to the prompt. Returns the (possibly)
 * modified params object — does not mutate the input.
 */
export async function applyPersonaToParams(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const mode = params.mode as GenerationMode | undefined
  const personaId = params.persona_id as string | undefined
  if (mode !== 'persona_replacement' || !personaId) return params

  const persona = await getPersona(personaId)
  if (!persona) {
    throw new Error(`Persona not found: ${personaId}`)
  }

  const userPrompt = String(params.prompt ?? '').trim()
  const face = persona.facial_details.trim()
  const body = persona.body_shape.trim()

  const descriptor = [face && `Face: ${face}`, body && `Body: ${body}`]
    .filter(Boolean)
    .join(' ')

  const prompt = descriptor
    ? userPrompt
      ? `${descriptor} Scene: ${userPrompt}`
      : descriptor
    : userPrompt

  return { ...params, prompt }
}
