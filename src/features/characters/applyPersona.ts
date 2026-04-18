import { getPersona } from '@/lib/personaApi'

export type GenerationMode = 'standard' | 'persona_replacement'

/**
 * If the params declare persona_replacement mode + a persona_id, look up the
 * persona, prepend its descriptors to the prompt, and append its stored image
 * URLs (face + body + reference_1..3) to `input_images[]` so the model has the
 * full visual + textual context. Returns the (possibly) modified params — does
 * not mutate the input.
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

  const existingInputs = Array.isArray(params.input_images)
    ? (params.input_images as string[])
    : []
  // Order: face → body → ref_1 → ref_2 → ref_3. Face carries the most
  // identifying information, so it goes first.
  const SLOT_ORDER = ['face', 'body', 'ref_1', 'ref_2', 'ref_3'] as const
  const personaUrls = SLOT_ORDER
    .map((slot) => persona.images.find((i) => i.slot === slot)?.url)
    .filter((u): u is string => typeof u === 'string')

  const input_images = [...existingInputs, ...personaUrls]

  return { ...params, prompt, input_images }
}
