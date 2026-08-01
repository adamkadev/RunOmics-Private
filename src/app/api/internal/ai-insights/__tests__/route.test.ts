import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { requestedLimit } from '../route'

function request(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/internal/ai-insights${query}`, { method: 'POST' })
}

describe('requestedLimit', () => {
  // The cron and every workflow_dispatch call this route with no ?limit= at
  // all. URLSearchParams.get returns null for that, and Number(null) is 0 -
  // coercing straight past the isInteger/negative guard below it - so this is
  // the one case that must not collapse to the explicit-opt-out value of 0.
  it('defaults when the run sends no limit at all, as every automated call does', () => {
    expect(requestedLimit(request())).toBe(6)
  })

  it('still allows an explicit ?limit=0 to report the backlog without spending', () => {
    expect(requestedLimit(request('?limit=0'))).toBe(0)
  })

  it('honours an explicit limit within the ceiling', () => {
    expect(requestedLimit(request('?limit=20'))).toBe(20)
  })

  it('caps an explicit limit at the ceiling', () => {
    expect(requestedLimit(request('?limit=999'))).toBe(60)
  })

  it('falls back to the default on a negative or non-numeric limit', () => {
    expect(requestedLimit(request('?limit=-5'))).toBe(6)
    expect(requestedLimit(request('?limit=abc'))).toBe(6)
  })
})
