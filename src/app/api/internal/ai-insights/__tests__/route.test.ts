import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPushToAllDevices } = vi.hoisted(() => ({ sendPushToAllDevices: vi.fn() }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushToAllDevices }))

const { notifyFreshVerdict, requestedLimit, shouldTryAnotherModel } = await import('../route')

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

describe('shouldTryAnotherModel', () => {
  it('moves on from a model that answered 429 or 404, as the pool exists for', () => {
    expect(shouldTryAnotherModel('http 429: quota exceeded')).toBe(true)
    expect(shouldTryAnotherModel('http 404: model not found')).toBe(true)
  })

  it('retries the Google-side congestion that wasted whole passes', () => {
    expect(shouldTryAnotherModel('http 503: This model is currently experiencing high demand.')).toBe(true)
    expect(shouldTryAnotherModel('http 500: internal')).toBe(true)
  })

  it('does not burn another model on copy the validator rejected', () => {
    expect(shouldTryAnotherModel('headline 61 > 56 chars')).toBe(false)
    expect(shouldTryAnotherModel('headline or body missing')).toBe(false)
    expect(shouldTryAnotherModel('3 bullets, expected 2')).toBe(false)
  })

  it('does not retry a request the API rejected outright', () => {
    expect(shouldTryAnotherModel('http 400: invalid argument')).toBe(false)
    expect(shouldTryAnotherModel('http 403: permission denied')).toBe(false)
  })
})

describe('notifyFreshVerdict', () => {
  it('sends the verdict itself as the push, not a generic "sync done" line', async () => {
    sendPushToAllDevices.mockClear()
    await notifyFreshVerdict({
      headline: 'Held together to the last rep',
      body: 'Only two seconds a kilometre of fade.',
    })

    expect(sendPushToAllDevices).toHaveBeenCalledWith(
      'Held together to the last rep',
      'Only two seconds a kilometre of fade.'
    )
  })

  it('swallows a push failure rather than letting it fail the sync it is reporting on', async () => {
    sendPushToAllDevices.mockClear()
    sendPushToAllDevices.mockRejectedValueOnce(new Error('FCM is down'))

    await expect(notifyFreshVerdict({ headline: 'h', body: 'b' })).resolves.toBeUndefined()
  })
})
