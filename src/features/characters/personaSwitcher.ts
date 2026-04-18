import { runVision } from '@/providers/vision'
import { getPersona } from '@/db/personas.repo'
import { createLogger } from '@/lib/log'

const log = createLogger('persona-switcher')

function buildRewritePrompt(face: string, body: string): string {
  const character = [face && `Face: ${face}`, body && `Body: ${body}`]
    .filter(Boolean)
    .join('\n')
  return `Look at this image. Produce a single, dense text-to-image prompt that recreates the SAME SCENE but with the person REPLACED by the character described below.

Keep ALL scene elements intact: pose, action, gesture, clothing/wardrobe, environment/location, lighting, mood, framing/composition, camera angle, art style.

REPLACE every visual detail of the person currently in the image — face shape, eye color, hair, skin tone, age, body shape, build, height, distinguishing physical features — with the character described here:

${character}

Output ONLY the final rewritten prompt as a single dense paragraph (80-150 words). No greeting, no markdown, no preamble, no labels, no quotes.`
}

const SYSTEM = 'You output only the final text-to-image prompt. No commentary, no labels, no markdown.'

interface ApplyContext {
  signal: AbortSignal
  onProgress?: (msg: string) => void
}

/**
 * If mode === 'persona_switcher' and an input image + persona are set, send
 * the image to a vision model that returns the FINAL text-to-image prompt
 * with the persona's character details swapped in for the original person.
 *
 * The source image is consumed for analysis only — it is REMOVED from
 * `input_images` in the returned params, so the downstream pipeline runs as
 * pure text-to-image (no image-edit step, no source image attached).
 *
 * The user's original prompt is appended after the rewritten prompt as
 * additional direction (e.g. "more cinematic", "warmer lighting").
 *
 * Vision model defaults to gemini-2.5-flash; override with
 * params.scene_vision_model.
 */
export async function applyPersonaSwitcherToParams(
  params: Record<string, unknown>,
  ctx: ApplyContext,
): Promise<Record<string, unknown>> {
  const mode = params.mode as string | undefined
  if (mode !== 'persona_switcher') return params

  const personaId = params.persona_id as string | undefined
  if (!personaId) {
    throw new Error('Persona switcher requires a persona to be selected')
  }

  const inputs = (params.input_images as string[] | undefined) ?? []
  const sourceImage = inputs[0]
  if (!sourceImage) {
    throw new Error('Persona switcher requires a source image')
  }

  const persona = await getPersona(personaId)
  if (!persona) throw new Error(`Persona not found: ${personaId}`)

  const visionModel =
    (params.scene_vision_model as string | undefined) ?? 'google/gemini-2.5-flash'

  const face = persona.facial_details.trim()
  const body = persona.body_shape.trim()
  if (!face && !body) {
    throw new Error(
      `Persona "${persona.name}" has no facial_details or body_shape — analyze it first`,
    )
  }

  log.info('starting persona swap', {
    personaId,
    personaName: persona.name,
    visionModel,
    sourceImagePreview:
      typeof sourceImage === 'string'
        ? sourceImage.startsWith('data:')
          ? `${sourceImage.slice(0, 30)}…(${sourceImage.length} chars)`
          : sourceImage
        : 'blob',
  })

  ctx.onProgress?.('rewriting prompt with persona…')
  const stopVision = log.timer('vision: persona swap rewrite')
  let result
  try {
    result = await runVision(
      {
        images: [sourceImage],
        prompt: buildRewritePrompt(face, body),
        system_prompt: SYSTEM,
        model: visionModel,
        temperature: 0.5,
      },
      {
        signal: ctx.signal,
        onProgress: (p) => p.message && ctx.onProgress?.(`rewrite: ${p.message}`),
      },
    )
  } catch (err) {
    log.error('vision rewrite call failed', err)
    throw err
  }
  stopVision()
  log.info('rewritten prompt', {
    chars: result.text.length,
    preview: result.text.slice(0, 300),
    usage: result.usage,
  })

  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const userDirection = String(params.prompt ?? '').trim()
  const finalPrompt = userDirection
    ? `${result.text.trim()} ${userDirection}`
    : result.text.trim()

  // Drop the source image — it was for analysis only. The downstream pipeline
  // should run as pure text-to-image, not image-edit.
  return { ...params, prompt: finalPrompt, input_images: [] }
}
