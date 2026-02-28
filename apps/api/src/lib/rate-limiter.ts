import type { Context, Next } from 'hono'

// Simple in-memory rate limiter for Cloudflare Workers.
// Tracks requests per IP using a Map with automatic TTL cleanup.
// Note: each Worker isolate has its own map — this is per-instance, not global.
// For stricter limiting, use Cloudflare Rate Limiting Rules (dashboard) or KV.

interface RateLimitEntry {
    count: number
    resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 60 seconds to prevent memory leaks
let lastCleanup = Date.now()
function cleanup() {
    const now = Date.now()
    if (now - lastCleanup < 60_000) return
    lastCleanup = now
    for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key)
    }
}

export function rateLimiter(opts: { windowMs: number; max: number }) {
    return async (c: Context, next: Next) => {
        cleanup()

        const ip = c.req.header('cf-connecting-ip')
            ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
            ?? 'unknown'

        const now = Date.now()
        const entry = store.get(ip)

        if (!entry || now > entry.resetAt) {
            // New window
            store.set(ip, { count: 1, resetAt: now + opts.windowMs })
            await next()
            return
        }

        entry.count++

        if (entry.count > opts.max) {
            // Rate limited
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
            c.header('Retry-After', retryAfter.toString())
            return c.json(
                { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
                429
            )
        }

        await next()
    }
}
