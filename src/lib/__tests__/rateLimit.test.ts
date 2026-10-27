import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { clientIp, createRateLimiter } from '../rateLimit'

const request = (headers: Record<string, string> = {}) => new NextRequest('https://run.example/api/x', { headers })

describe('createRateLimiter', () => {
  it('lets max requests through per window and tells when to retry', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, maxKeys: 10 })
    expect(limiter.take('a', 0)).toEqual({ ok: true })
    expect(limiter.take('a', 1_000)).toEqual({ ok: true })
    expect(limiter.take('a', 2_000)).toEqual({ ok: false, retryAfterS: 58 })
    expect(limiter.take('b', 2_000)).toEqual({ ok: true })
    expect(limiter.take('a', 60_000)).toEqual({ ok: true })
  })

  it('forgets the oldest keys beyond maxKeys', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 2 })
    limiter.take('a', 0)
    limiter.take('b', 1)
    limiter.take('c', 2)
    expect(limiter.take('a', 3)).toEqual({ ok: true })
  })
})

describe('clientIp', () => {
  it('takes the first forwarded address, then x-real-ip', () => {
    expect(clientIp(request({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientIp(request({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIp(request())).toBe('unknown')
  })
})
