import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getGoalsPageData, sendPush, sent } = vi.hoisted(() => ({
  getGoalsPageData: vi.fn(),
  sendPush: vi.fn(),
  sent: new Set<string>(),
}))

vi.mock('@/application/usecases/LoadData', () => ({ loadData: vi.fn() }))
vi.mock('@/application/usecases/GetGoalsData', () => ({ getGoalsPageData }))
vi.mock('@/application/usecases/GetCoachingReminder', () => ({ getCoachingReminder: () => null }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush, sendPushes: vi.fn() }))
vi.mock('@/lib/opsPush', () => ({ opsStrings: {}, sendOpsPush: vi.fn() }))
vi.mock('@/application/usecases/SendScheduledPush', () => ({
  sendOncePer: async (push: string, key: string, send: () => Promise<void>) => {
    if (sent.has(`${push}:${key}`)) return false
    sent.add(`${push}:${key}`)
    await send()
    return true
  },
}))

const SECRET = 'test-secret'
const request = () =>
  new NextRequest('https://example.com/api/internal/weekly-reminder', { method: 'POST', headers: { 'x-internal-secret': SECRET } })

describe('POST /api/internal/weekly-reminder', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.stubEnv('NEXT_PUBLIC_TIME_ZONE', 'Europe/Paris')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-02T09:00:00Z'))
    vi.clearAllMocks()
    sent.clear()
    sendPush.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('asks once for the new year’s goal on 2 January 2027 instead of skipping silently', async () => {
    getGoalsPageData.mockResolvedValue({ byYear: {}, missingGoalYear: 2027 })
    const { POST } = await import('../route')

    expect(await (await POST(request())).json()).toEqual({ sent: false, coachBlock: false, goalYear: true })
    expect(getGoalsPageData).toHaveBeenCalledWith('2027-01-02')
    expect(sendPush).toHaveBeenCalledWith('training', expect.objectContaining({ title: 'No goal set for 2027', link: '/goals', tag: 'goal-year' }))

    expect(await (await POST(request())).json()).toEqual({ sent: false, coachBlock: false, goalYear: false })
    expect(sendPush).toHaveBeenCalledTimes(1)
  })

  it('sends the goal check-in alone when the year has its goal', async () => {
    getGoalsPageData.mockResolvedValue({
      byYear: { 2027: { projection: { status: 'on_track', weeklyRate: 30, weeklyNeeded: 30 } } },
      missingGoalYear: null,
    })
    const { POST } = await import('../route')

    expect(await (await POST(request())).json()).toEqual({ sent: true, status: 'on_track', coachBlock: false, goalYear: false })
    expect(sendPush).toHaveBeenCalledTimes(1)
  })
})
