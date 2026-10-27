import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn() }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))
vi.mock('@/infrastructure/githubTokenExpiry', () => ({ githubTokenExpiry: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'

let caller = 0

function request(tokens: unknown) {
  return new NextRequest('https://example.com/api/internal/token-expiry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.2.${Math.floor(++caller / 250)}.${caller % 250}`,
      'x-internal-secret': SECRET,
    },
    body: JSON.stringify({ tokens }),
  })
}

describe('POST /api/internal/token-expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'))
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.stubEnv('RUNOMICS_DATA_REPO_TOKEN', '')
    vi.stubEnv('GITHUB_SYNC_TOKEN', '')
    sendPush.mockReset()
    sendPush.mockResolvedValue({ sent: 1, failed: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('warns about the Garmin key from its bare date, in its own push, linked to Settings', async () => {
    const res = await POST(request([{ name: 'garminKey', expiresAt: '2026-11-05' }]))

    expect(await res.json()).toEqual({ tokens: [{ name: 'garminKey', expiresAt: '2026-11-05' }], warned: true })
    expect(sendPush).toHaveBeenCalledTimes(1)
    expect(sendPush).toHaveBeenCalledWith('always', {
      title: 'The Garmin key expires in 8 days',
      body: expect.stringContaining('connect.garmin.com/app/settings/personalApiToken'),
      link: '/settings',
      tag: 'garmin-key-expiry',
    })
  })

  it('sends the GitHub tokens and the Garmin key as two warnings with their own tags', async () => {
    await POST(
      request([
        { name: 'dataActions', expiresAt: '2026-11-01 00:00:00 UTC' },
        { name: 'garminKey', expiresAt: '2026-11-08' },
      ])
    )

    expect(sendPush.mock.calls.map(([, push]) => [push.title, push.tag])).toEqual([
      ['A GitHub token expires in 4 days', 'token-expiry'],
      ['The Garmin key expires in 11 days', 'garmin-key-expiry'],
    ])
  })

  it('stays quiet about a key with months left, and ignores a date it cannot read', async () => {
    const res = await POST(
      request([
        { name: 'garminKey', expiresAt: '2027-10-01' },
        { name: 'garminKey', expiresAt: '2026-02-30' },
      ])
    )

    expect(await res.json()).toEqual({ tokens: [{ name: 'garminKey', expiresAt: '2027-10-01' }], warned: false })
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('still sends the second warning when the first fails, then answers 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sendPush.mockRejectedValueOnce(new Error('FCM is down'))

    const res = await POST(
      request([
        { name: 'dataActions', expiresAt: '2026-11-01 00:00:00 UTC' },
        { name: 'garminKey', expiresAt: '2026-11-08' },
      ])
    )

    expect(res.status).toBe(500)
    expect(sendPush).toHaveBeenCalledTimes(2)
  })
})
