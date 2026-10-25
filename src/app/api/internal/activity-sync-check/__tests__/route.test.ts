import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Activity } from '@/domain/activity/types'

const { getNewActivities, sendPushes } = vi.hoisted(() => ({
  getNewActivities: vi.fn(),
  sendPushes: vi.fn(),
}))

vi.mock('@/application/usecases/GetNewActivities', () => ({ getNewActivities }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushes, sendPush: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const RUNS = [
  { id: 'r2', description: 'Evening tempo', distanceKm: 10.4, durationSeconds: 2700, type: 'Tempo' },
  { id: 'r1', description: 'Morning easy', distanceKm: 8.2, durationSeconds: 2880, type: 'Base' },
] as unknown as Activity[]

function request() {
  return new NextRequest('https://example.com/api/internal/activity-sync-check', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

describe('POST /api/internal/activity-sync-check', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('announces every new run in one batch, then records them as seen', async () => {
    const commit = vi.fn(async () => {})
    getNewActivities.mockResolvedValue({ newActivities: RUNS, commit })
    sendPushes.mockResolvedValue(undefined)

    const res = await POST(request())

    expect(await res.json()).toEqual({ newActivities: ['r2', 'r1'] })
    expect(sendPushes).toHaveBeenCalledWith('training', [
      expect.objectContaining({ title: 'New activity: Evening tempo' }),
      expect.objectContaining({ title: 'New activity: Morning easy' }),
    ])
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPushes.mock.invocationCallOrder[0]!)
  })

  it('does not record the runs as seen when a push failed, so the next check announces them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = vi.fn(async () => {})
    getNewActivities.mockResolvedValue({ newActivities: RUNS, commit })
    sendPushes.mockRejectedValue(new Error('FCM is down'))

    expect((await POST(request())).status).toBe(500)
    expect(commit).not.toHaveBeenCalled()
  })
})
