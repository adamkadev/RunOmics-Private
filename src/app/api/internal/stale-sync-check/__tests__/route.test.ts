import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getStaleSyncAlert, sendPush } = vi.hoisted(() => ({
  getStaleSyncAlert: vi.fn(),
  sendPush: vi.fn(),
}))

vi.mock('@/application/usecases/GetStaleSyncAlert', () => ({ getStaleSyncAlert }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush, sendPushes: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'

function request() {
  return new NextRequest('https://example.com/api/internal/stale-sync-check', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

describe('POST /api/internal/stale-sync-check', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sends the stale-sync warning, then records that it did', async () => {
    const commit = vi.fn(async () => {})
    getStaleSyncAlert.mockResolvedValue({ alert: { hoursSinceSync: 80 }, commit })
    sendPush.mockResolvedValue(undefined)

    const res = await POST(request())

    expect(await res.json()).toEqual({ sent: true, alert: { hoursSinceSync: 80 } })
    expect(sendPush).toHaveBeenCalledWith('always', {
      title: 'No data synced in a while',
      body: 'Your last sync was 80h ago - check that sync is still running.',
      link: '/settings',
      tag: 'stale-sync',
    })
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPush.mock.invocationCallOrder[0]!)
  })

  it('stays armed when the warning did not go out, so the next check sends it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = vi.fn(async () => {})
    getStaleSyncAlert.mockResolvedValue({ alert: { hoursSinceSync: 80 }, commit })
    sendPush.mockRejectedValue(new Error('FCM is down'))

    expect((await POST(request())).status).toBe(500)
    expect(commit).not.toHaveBeenCalled()
  })

  it('re-arms without a push once syncs are landing again', async () => {
    const commit = vi.fn(async () => {})
    getStaleSyncAlert.mockResolvedValue({ alert: null, commit })

    const res = await POST(request())

    expect(await res.json()).toEqual({ sent: false, alert: null })
    expect(sendPush).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
