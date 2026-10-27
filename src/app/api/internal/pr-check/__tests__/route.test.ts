import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getNewPrs, getNewReturnMilestones, sendPushes } = vi.hoisted(() => ({
  getNewPrs: vi.fn(),
  getNewReturnMilestones: vi.fn(),
  sendPushes: vi.fn(),
}))

vi.mock('@/application/usecases/GetNewPrs', () => ({ getNewPrs }))
vi.mock('@/application/usecases/GetNewReturnMilestones', () => ({ getNewReturnMilestones }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushes, sendPush: vi.fn() }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const PRS = [
  { key: '5k', label: '5K', seconds: 1150, activityId: 'a', date: '2026-09-23' },
  { key: '10k', label: '10K', seconds: 2400, activityId: 'a', date: '2026-09-23' },
]

function request() {
  return new NextRequest('https://example.com/api/internal/pr-check', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

describe('POST /api/internal/pr-check', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
    getNewReturnMilestones.mockResolvedValue({ newMilestones: [], commit: vi.fn(async () => {}) })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('announces every new PR in one batch, and stores the marks only after it went out', async () => {
    const commit = vi.fn(async () => {})
    getNewPrs.mockResolvedValue({ newPrs: PRS, commit })
    sendPushes.mockResolvedValue(undefined)

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ newPrs: PRS, newReturnMilestones: [] })
    expect(sendPushes).toHaveBeenCalledWith('records', [
      { title: 'New PR: 5K', body: '19:10 - new personal best!', link: '/activities/a', tag: 'record:5k' },
      { title: 'New PR: 10K', body: '40:00 - new personal best!', link: '/activities/a', tag: 'record:10k' },
    ])
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPushes.mock.invocationCallOrder[0]!)
  })

  it('leaves the marks unstored when a push failed, so the next run offers the PRs again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = vi.fn(async () => {})
    getNewPrs.mockResolvedValue({ newPrs: PRS, commit })
    sendPushes.mockRejectedValue(new AggregateError([new Error('FCM is down')], '1 of 2 pushes failed'))

    const res = await POST(request())

    expect(res.status).toBe(500)
    expect(commit).not.toHaveBeenCalled()
  })

  it('still stores the marks when nothing was beaten, so the next run compares against them', async () => {
    const commit = vi.fn(async () => {})
    getNewPrs.mockResolvedValue({ newPrs: [], commit })
    sendPushes.mockResolvedValue(undefined)

    expect((await POST(request())).status).toBe(200)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('announces a milestone since the return in the records category, and stores it after it went out', async () => {
    const commit = vi.fn(async () => {})
    getNewPrs.mockResolvedValue({ newPrs: [], commit: vi.fn(async () => {}) })
    getNewReturnMilestones.mockResolvedValue({
      newMilestones: [
        { key: 'continuous20', date: '2026-10-26', activityId: 'r1' },
        { key: 'blockCompleted', date: '2026-10-26', activityId: null },
      ],
      commit,
    })
    sendPushes.mockResolvedValue(undefined)

    expect((await POST(request())).status).toBe(200)
    expect(sendPushes).toHaveBeenCalledWith('records', [
      { title: 'A milestone since your return', body: 'First 20 minutes non-stop!', link: '/activities/r1', tag: 'return:continuous20' },
      { title: 'A milestone since your return', body: 'First block completed!', link: '/records?tab=return', tag: 'return:blockCompleted' },
    ])
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(sendPushes.mock.invocationCallOrder[0]!)
  })
})
