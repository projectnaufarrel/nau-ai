import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { webhookRouter } from './routes/webhook'
import { chatRouter } from './routes/chat'

export interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  GOOGLE_GENERATIVE_AI_API_KEY: string
  ALLOWED_ORIGIN?: string // set to your frontend URL in production, e.g. https://naufarrel.pages.dev
}

const app = new Hono<{ Bindings: Env }>()

// CORS only for /api/* — webhook is server-to-server (Line calls us, no browser involved)
// In production, set ALLOWED_ORIGIN to your frontend domain via wrangler secret put
app.use('/api/*', async (c, next) => {
  const allowedOrigin = c.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
  return cors({
    origin: allowedOrigin,
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })(c, next)
})

app.get('/', (c) => c.json({ status: 'ok', project: 'naufarrel' }))
app.route('/webhook', webhookRouter)
app.route('/api/chat', chatRouter)

export default app
