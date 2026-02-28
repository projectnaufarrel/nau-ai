import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { webhookRouter } from './routes/webhook'
import { chatRouter } from './routes/chat'
import { rateLimiter } from './lib/rate-limiter'

export interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  MOONSHOT_API_KEY: string
  ALLOWED_ORIGIN?: string // set to your frontend URL in production, e.g. https://naufarrel.pages.dev
}

const app = new Hono<{ Bindings: Env }>()

// CORS only for /api/* — webhook is server-to-server (Line calls us, no browser involved)
// In production, set ALLOWED_ORIGIN to your frontend domain via wrangler secret put
app.use('/api/*', async (c, next) => {
  const configuredOrigin = c.env.ALLOWED_ORIGIN
  // Dev: allow any localhost origin (Vite may pick 5173, 5174, etc.)
  // Prod: use ALLOWED_ORIGIN from env
  const origin = configuredOrigin
    ? configuredOrigin
    : (requestOrigin: string) => requestOrigin.startsWith('http://localhost:') ? requestOrigin : null
  return cors({
    origin,
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })(c, next)
})

// Rate limit on /api/* — 20 requests per minute per IP.
// Protects against LLM cost abuse. Webhook excluded (Line server-to-server).
app.use('/api/*', rateLimiter({ windowMs: 60_000, max: 20 }))

app.get('/', (c) => c.json({ status: 'ok', project: 'naufarrel' }))
app.route('/webhook', webhookRouter)
app.route('/api/chat', chatRouter)

export default app
