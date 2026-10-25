import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { guardInternalRequest, isAuthorizedCronRequest, isAuthorizedInternalRequest } from '@/lib/internalAuth'

const SECRET = 'test-secret'

function makeRequest({ secret, ip }: { secret?: string; ip?: string } = {}) {
  const headers = new Headers()
  if (secret !== undefined) headers.set('x-internal-secret', secret)
  if (ip !== undefined) headers.set('x-forwarded-for', ip)
  return new NextRequest('http://localhost/api/internal/test', { headers })
}

describe('internalAuth', () => {
  beforeEach(() => {
    process.env.INTERNAL_NOTIFY_SECRET = SECRET
  })
  afterEach(() => {
    delete process.env.INTERNAL_NOTIFY_SECRET
  })

  describe('isAuthorizedInternalRequest', () => {
    it('accepts the correct secret', () => {
      expect(isAuthorizedInternalRequest(makeRequest({ secret: SECRET }))).toBe(true)
    })

    it('rejects a wrong or missing secret', () => {
      expect(isAuthorizedInternalRequest(makeRequest({ secret: 'nope' }))).toBe(false)
      expect(isAuthorizedInternalRequest(makeRequest())).toBe(false)
    })

    it('rejects everything when the env secret is unset', () => {
      delete process.env.INTERNAL_NOTIFY_SECRET
      expect(isAuthorizedInternalRequest(makeRequest({ secret: SECRET }))).toBe(false)
    })
  })

  describe('isAuthorizedCronRequest', () => {
    afterEach(() => {
      delete process.env.CRON_SECRET
    })

    const cron = (authorization?: string) =>
      new NextRequest('http://localhost/api/internal/test', { headers: authorization ? { authorization } : {} })

    it("accepts Vercel Cron's bearer secret, and neither the internal secret nor a wrong bearer", () => {
      process.env.CRON_SECRET = 'cron-secret'
      expect(isAuthorizedCronRequest(cron('Bearer cron-secret'))).toBe(true)
      expect(isAuthorizedCronRequest(cron('Bearer nope'))).toBe(false)
      expect(isAuthorizedCronRequest(cron(`Bearer ${SECRET}`))).toBe(false)
      expect(isAuthorizedCronRequest(cron())).toBe(false)
    })

    it('rejects everything when CRON_SECRET is unset', () => {
      expect(isAuthorizedCronRequest(cron('Bearer '))).toBe(false)
      expect(isAuthorizedCronRequest(cron('Bearer undefined'))).toBe(false)
    })
  })

  describe('guardInternalRequest', () => {
    it('returns null for an authorized request', () => {
      expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.0.0.1' }))).toBeNull()
    })

    it('returns 401 for a bad secret', () => {
      const res = guardInternalRequest(makeRequest({ secret: 'nope', ip: '10.0.0.2' }))
      expect(res?.status).toBe(401)
    })

    it('returns 429 once an IP exceeds the per-minute budget, without affecting other IPs', () => {
      for (let i = 0; i < 20; i++) {
        expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.9' }))).toBeNull()
      }
      const limited = guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.9' }))
      expect(limited?.status).toBe(429)

      const limitedBadSecret = guardInternalRequest(makeRequest({ secret: 'nope', ip: '10.9.9.9' }))
      expect(limitedBadSecret?.status).toBe(429)

      expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.8' }))).toBeNull()
    })
  })

  describe('rejection log', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    const warnings = () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      return () => warn.mock.calls.map(([line]) => JSON.parse(line as string))
    }

    it('logs a refused secret as one line: the route and why, nothing the caller sent', () => {
      const logged = warnings()

      guardInternalRequest(makeRequest({ secret: 'a-guessed-secret', ip: '203.0.113.7' }))

      expect(logged()).toEqual([
        { level: 'warn', event: 'request-rejected', route: '/api/internal/test', reason: 'unauthorized' },
      ])
      expect(JSON.stringify(logged())).not.toMatch(/a-guessed-secret|203\.0\.113\.7/)
    })

    it('logs a rate-limited caller under its own reason', () => {
      for (let i = 0; i < 20; i++) guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.7.7.7' }))
      const logged = warnings()

      guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.7.7.7' }))

      expect(logged()).toEqual([
        { level: 'warn', event: 'request-rejected', route: '/api/internal/test', reason: 'rate-limited' },
      ])
    })

    it('stays quiet about a request it lets through', () => {
      const logged = warnings()

      guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.0.0.3' }))

      expect(logged()).toEqual([])
    })
  })
})
