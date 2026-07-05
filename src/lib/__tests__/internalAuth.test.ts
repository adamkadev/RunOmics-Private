import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { guardInternalRequest, isAuthorizedInternalRequest } from '@/lib/internalAuth'

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

  describe('guardInternalRequest', () => {
    it('returns null for an authorized request', () => {
      expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.0.0.1' }))).toBeNull()
    })

    it('returns 401 for a bad secret', () => {
      const res = guardInternalRequest(makeRequest({ secret: 'nope', ip: '10.0.0.2' }))
      expect(res?.status).toBe(401)
    })

    it('returns 429 once an IP exceeds the per-minute budget, without affecting other IPs', () => {
      // Exhaust the window for one IP (limit is 20/min).
      for (let i = 0; i < 20; i++) {
        expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.9' }))).toBeNull()
      }
      const limited = guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.9' }))
      expect(limited?.status).toBe(429)

      // Unauthorized attempts are also throttled once over budget.
      const limitedBadSecret = guardInternalRequest(makeRequest({ secret: 'nope', ip: '10.9.9.9' }))
      expect(limitedBadSecret?.status).toBe(429)

      // A different IP still has its own budget.
      expect(guardInternalRequest(makeRequest({ secret: SECRET, ip: '10.9.9.8' }))).toBeNull()
    })
  })
})
