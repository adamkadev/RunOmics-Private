import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getShoeWearAlerts, sendPushes } = vi.hoisted(() => ({
  getShoeWearAlerts: vi.fn(),
  sendPushes: vi.fn(),
}))

vi.mock('@/application/usecases/GetShoeWearAlerts', () => ({ getShoeWearAlerts }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushes, sendPush: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const WORN = [{ gearId: 'g1', name: 'Cloudrun 4', totalKm: 712, alertThresholdKm: 700 }]

function request() {
  return new NextRequest('https://example.com/api/internal/shoe-wear-check', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

describe('POST /api/internal/shoe-wear-check', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sends the wear alert, then records the shoe as alerted', async () => {
    const commit = vi.fn(async () => {})
    getShoeWearAlerts.mockResolvedValue({ newAlerts: WORN, commit })
    sendPushes.mockResolvedValue(undefined)

    const res = await POST(request())

    expect(await res.json()).toEqual({ newAlerts: WORN })
    expect(sendPushes).toHaveBeenCalledWith('shoes', [
      { title: 'Shoe wear alert: Cloudrun 4', body: '712 km - past its 700 km alert threshold' },
    ])
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPushes.mock.invocationCallOrder[0]!)
  })

  it('does not record the shoe as alerted when the push failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = vi.fn(async () => {})
    getShoeWearAlerts.mockResolvedValue({ newAlerts: WORN, commit })
    sendPushes.mockRejectedValue(new Error('FCM is down'))

    expect((await POST(request())).status).toBe(500)
    expect(commit).not.toHaveBeenCalled()
  })
})
