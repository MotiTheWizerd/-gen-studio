import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import path from 'node:path'
import { config } from './config.js'
import { runMigrations } from './migrate.js'
import { personasRoutes } from './routes.personas.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.route('/api/v1/personas', personasRoutes)

// Static file serving. Maps /static/<rest> -> <dataRoot>/<rest>
const staticRoot = path.relative(process.cwd(), config.dataRoot) || '.'
app.use(
  '/static/*',
  serveStatic({
    root: './',
    rewriteRequestPath: (p) => p.replace(/^\/static/, `/${staticRoot}`),
  }),
)

await runMigrations()

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`[server] listening on http://${info.address}:${info.port}`)
  console.log(`[server] data root: ${config.dataRoot}`)
})
