/**
 * Typed access to Vite env vars. Add new keys here as providers come online.
 * All keys must start with VITE_ to be exposed to the client by Vite.
 *
 * NOTE: client-side keys are visible in the browser bundle. Fine for local
 * personal use; swap for a server proxy before publishing this anywhere.
 */
export const env = {
  FAL_KEY: import.meta.env.VITE_FAL_KEY as string | undefined,
  REPLICATE_TOKEN: import.meta.env.VITE_REPLICATE_TOKEN as string | undefined,
  OPENAI_KEY: import.meta.env.VITE_OPENAI_KEY as string | undefined,
  KIE_KEY: import.meta.env.VITE_KIE_KEY as string | undefined,
  MODELSLAB_KEY: import.meta.env.VITE_MODELSLAB_KEY as string | undefined,
  POYO_KEY: import.meta.env.VITE_POYO_KEY as string | undefined,
}

export function hasKey(k: keyof typeof env): boolean {
  return typeof env[k] === 'string' && env[k]!.length > 0
}

export function maskKey(v: string | undefined): string {
  if (!v) return 'not set'
  if (v.length <= 8) return '••••'
  return `${v.slice(0, 4)}••••${v.slice(-4)}`
}
