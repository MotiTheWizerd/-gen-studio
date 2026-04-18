import { runVision } from '@/providers/vision'

const FACE_PROMPT = `Describe this person's facial features for use as a text-to-image prompt that another model can use to redraw the same face consistently.
Cover: face shape, skin tone, eye color and shape, eyebrows, nose, lips, hair color/length/style, facial hair, age range, distinctive marks (freckles, scars, glasses, piercings).
Be specific and concrete. No greeting, no markdown, no preamble. Output a single dense paragraph (60-120 words).`

const BODY_PROMPT = `Describe this person's body shape and physical build for use as a text-to-image prompt that another model can use to redraw the same body consistently.
Cover: height impression, build (slim/athletic/curvy/broad/etc), proportions, posture, distinguishing physical features. Ignore clothing and background.
No greeting, no markdown, no preamble. Output a single dense paragraph (40-80 words).`

const SYSTEM = 'Only answer with the description. Do not add prefixes, suffixes, or formatting.'

export interface AnalyzeInput {
  faceImage?: Blob
  bodyImage?: Blob
  model: string
  signal: AbortSignal
  onProgress?: (msg: string) => void
}

export interface AnalyzeOutput {
  facial_details?: string
  body_shape?: string
}

export async function analyzePersona(input: AnalyzeInput): Promise<AnalyzeOutput> {
  const { faceImage, bodyImage, model, signal, onProgress } = input

  const tasks: Promise<['face' | 'body', string]>[] = []

  if (faceImage) {
    tasks.push(
      runVision(
        {
          images: [faceImage],
          prompt: FACE_PROMPT,
          system_prompt: SYSTEM,
          model,
          temperature: 0.4,
        },
        { signal, onProgress: (p) => p.message && onProgress?.(`face: ${p.message}`) },
      ).then((r) => ['face' as const, r.text.trim()]),
    )
  }

  if (bodyImage) {
    tasks.push(
      runVision(
        {
          images: [bodyImage],
          prompt: BODY_PROMPT,
          system_prompt: SYSTEM,
          model,
          temperature: 0.4,
        },
        { signal, onProgress: (p) => p.message && onProgress?.(`body: ${p.message}`) },
      ).then((r) => ['body' as const, r.text.trim()]),
    )
  }

  const out: AnalyzeOutput = {}
  const results = await Promise.all(tasks)
  for (const [key, text] of results) {
    if (key === 'face') out.facial_details = text
    else out.body_shape = text
  }
  return out
}
