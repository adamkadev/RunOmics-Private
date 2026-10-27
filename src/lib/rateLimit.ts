/**
 * Best effort, not a security boundary: it lives in one instance's memory, so
 * each instance counts on its own and a cold start forgets. The clock is passed
 * in, so a test needs no fake timers.
 */

import type { NextRequest } from 'next/server'

export type RateLimitDecision = { ok: true } | { ok: false; retryAfterS: number }

export interface RateLimiter {
  take(key: string, now: number): RateLimitDecision
}

export interface RateLimitOptions {
  max: number
  windowMs: number
  /** Bounds memory however many keys (forwarded IPs, say) a caller can invent. */
  maxKeys: number
}

export function createRateLimiter({ max, windowMs, maxKeys }: RateLimitOptions): RateLimiter {
  // Insertion order is window-start order: a key whose window restarts is
  // deleted and set again, so it moves to the end.
  const windows = new Map<string, { count: number; start: number }>()

  function prune(now: number): void {
    for (const [key, window] of windows) {
      if (windows.size < maxKeys && now - window.start < windowMs) break
      windows.delete(key)
    }
  }

  return {
    take(key, now) {
      const window = windows.get(key)
      if (window && now - window.start < windowMs) {
        if (window.count >= max) {
          return { ok: false, retryAfterS: Math.max(1, Math.ceil((window.start + windowMs - now) / 1000)) }
        }
        window.count += 1
        return { ok: true }
      }

      windows.delete(key)
      if (windows.size >= maxKeys) prune(now)
      windows.set(key, { count: 1, start: now })
      return { ok: true }
    },
  }
}

/** For counting requests only - never logged. Vercel sets x-forwarded-for itself, so its first entry is the client's. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}
