import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { requestedLimit } from '../route'

function request(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/internal/ai-insights${query}`, { method: 'POST' })
}

describe('requestedLimit', () => {
  it('defaults when the run sends no limit at all, as every automated call does', () => {
    expect(requestedLimit(request())).toBe(24)
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
    expect(requestedLimit(request('?limit=-5'))).toBe(24)
    expect(requestedLimit(request('?limit=abc'))).toBe(24)
  })
})
