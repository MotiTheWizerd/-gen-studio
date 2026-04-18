import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/config.ts → ../.env is server/.env. Load it exclusively so the
// root vibe-studio .env (with other projects' PORT/DATABASE_URL) never leaks in.
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}. Copy server/.env.example to server/.env and fill it in.`)
  return v
}

const port = Number(process.env.PORT ?? 8787)

export const config = {
  port,
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL'),
  dataRoot: path.resolve(process.cwd(), process.env.DATA_ROOT ?? 'data'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
} as const
