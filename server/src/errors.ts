import type { Context } from 'hono'

export type ErrorCode =
  | 'validation_failed'
  | 'persona_not_found'
  | 'invalid_slot'
  | 'unsupported_media_type'
  | 'file_too_large'
  | 'internal_error'

export function errorResp(c: Context, status: number, code: ErrorCode, message: string) {
  return c.json({ error: { code, message } }, status as 400 | 404 | 413 | 500)
}
