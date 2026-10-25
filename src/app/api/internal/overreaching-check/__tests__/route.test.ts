import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getOverreachingAlerts, sendPushes } = vi.hoisted(() => ({
  getOverreachingAlerts: vi.fn(),
  sendPushes: vi.fn(),
}))

vi.mock('@/application/usecases/GetOverreachingAlerts', () => ({ getOverreachingAlerts }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushes, sendPush: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'

function request() {
  return new NextRequest('https://example.com/api/internal/overreaching-check', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

describe('POST /api/internal/overreaching-check', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('warns about the risk, then records that it did', async () => {
    const commit = vi.fn(async () => {})
    const alert = { tsb: -34, acwr: 1.6, ctlDelta: 5.2 }
    getOverreachingAlerts.mockResolvedValue({ newAlerts: [alert], commit })
    sendPushes.mockResolvedValue(undefined)

    const res = await POST(request())

    expect(await res.json()).toEqual({ newAlerts: [alert] })
    expect(sendPushes).toHaveBeenCalledWith('training', [
      {
        title: 'Overreaching risk detected',
        body: 'Form (TSB) -34, ACWR 1.6 - high training risk, consider recovery.',
      },
    ])
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPushes.mock.invocationCallOrder[0]!)
  })

  it('stays armed when the warning did not go out, so the next check sends it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = vi.fn(async () => {})
    getOverreachingAlerts.mockResolvedValue({ newAlerts: [{ tsb: -34, acwr: null, ctlDelta: 5.2 }], commit })
    sendPushes.mockRejectedValue(new Error('FCM is down'))

    expect((await POST(request())).status).toBe(500)
    expect(commit).not.toHaveBeenCalled()
  })
})
