import { createLogger } from '@/lib/log'
import { getModelslabKey } from './client'

const log = createLogger('modelslab-upload')
const BASE64_TO_URL = 'https://modelslab.com/api/v6/base64_to_url'

/**
 * Upload a data: URI to modelslab so it becomes a hostable https URL the
 * generation endpoints can fetch. http(s) URLs pass through untouched.
 * URLs expire ~24h; 5MB hard cap per file.
 */
export async function uploadBase64ToUrl(
  input: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!input.startsWith('data:')) return input

  const res = await fetch(BASE64_TO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: getModelslabKey(), base64_string: input }),
    signal,
  })
  const text = await res.text()
  let data: { status?: string; output?: string[]; message?: string }
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    log.error('base64_to_url invalid JSON', { status: res.status, body: text.slice(0, 400) })
    throw new Error(`modelslab base64_to_url returned non-JSON (status ${res.status})`)
  }
  if (!res.ok || data.status !== 'success' || !data.output?.[0]) {
    log.error('base64_to_url failed', { status: res.status, body: data })
    throw new Error(
      `modelslab base64_to_url: ${data.message ?? `status ${data.status ?? res.status}`}`,
    )
  }
  log.info('base64_to_url ✓', { url: data.output[0] })
  return data.output[0]
}
