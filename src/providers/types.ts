import type { z } from 'zod'

export type MediaKind = 'image' | 'video'

export interface MediaResult {
  kind: MediaKind
  blob: Blob
  mime: string
  width?: number
  height?: number
  durationMs?: number
}

export interface JobResult {
  media: MediaResult[]
  raw?: unknown
}

export interface RunContext {
  signal: AbortSignal
  onProgress?: (p: { pct?: number; message?: string }) => void
}

export interface Model<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  providerId: string
  kind: MediaKind
  label: string
  description?: string
  /**
   * Zod schema drives the auto-generated ParamsPanel form. Using ZodTypeAny
   * (instead of ZodType<P>) avoids input/output variance headaches with
   * `.default()` and `.optional()` fields.
   */
  paramSchema: z.ZodTypeAny
  defaults: P
  run: (params: P, ctx: RunContext) => Promise<JobResult>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModel = Model<any>

export interface Provider {
  id: string
  label: string
  kinds: MediaKind[]
  /** Optional key check — if returns false, ProvidersPage will flag missing keys. */
  isConfigured?: () => boolean
  /** Optional human-readable setup hint for ProvidersPage. */
  setupHint?: string
  models: AnyModel[]
}
