import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatus } from '../GetTrainingStatus'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash } from '@/domain/ai/todayInsight'
import { isoDate } from '@/lib/calendarDate'

const { getActivitySummaries, readVerifiedInsight } = vi.hoisted(() => ({
  getActivitySummaries: vi.fn(),
  readVerifiedInsight: vi.fn(),
}))

vi.mock('../GetActivities', () => ({ getActivitySummaries }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { buildTodayContext, getTodayInsight } = await import('../GetTodayInsight')

const NOW = new Date('2026-07-20T09:00:00')
const INSIGHT = { headline: 'Fresh legs today', body: 'Form is back above zero, so the tempo can be honest.' }

function status(overrides: Partial<TrainingStatus> = {}): TrainingStatus {
  return {
    status: 'productive',
    risk: 'low',
    loadTrend: 'building',
    ctl: 58,
    atl: 52,
    tsb: 6,
    tsbNow: 8,
    acwr: 1.1,
    ctlDelta: 2.4,
    atlDelta: -2.1,
    ctlPeak: 60,
    source: 'garmin',
    acwrStatus: 'OPTIMAL',
    chronicLoad: 420,
    chronicLoadMin: 380,
    chronicLoadMax: 480,
    ...overrides,
  }
}

const summary = (date: string, distanceKm = 10): ActivitySummary =>
  ({ date, distanceKm, type: 'Base', durationSeconds: 3000, avgHeartRate: 145 }) as ActivitySummary

const WORKOUT: PlannedWorkout = { date: '2026-07-20', name: 'Threshold 3x8', type: 'Threshold', durationSecs: 2700 }

function withHistory(activities: ActivitySummary[]) {
  getActivitySummaries.mockReturnValue(activities)
}

describe('buildTodayContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withHistory([summary('2026-07-18'), summary('2026-07-15'), summary('2026-06-01')])
  })

  it('reads the tone off the status the hero is rendered from', () => {
    expect(buildTodayContext(status(), null, NOW).tone).toBe('go')
    expect(buildTodayContext(status({ status: 'overreaching' }), null, NOW).tone).toBe('hold')
  })

  it('carries the last seven days of training, which is what makes the copy specific', () => {
    const context = buildTodayContext(status(), null, NOW)

    expect(context.recent.runs).toBe(2)
    expect(context.recent.lastRun).toEqual({ type: 'Base', daysAgo: 2, distanceKm: 10 })
  })

  it('carries the planned session, or the absence of one', () => {
    expect(buildTodayContext(status(), WORKOUT, NOW).plannedWorkout).toBe(WORKOUT)
    expect(buildTodayContext(status(), null, NOW).plannedWorkout).toBeNull()
  })

  it('never looks past the day it is built for', () => {
    withHistory([summary('2026-07-25'), summary('2026-07-18')])

    expect(buildTodayContext(status(), null, NOW).recent.lastRun?.daysAgo).toBe(2)
  })
})

describe('getTodayInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withHistory([summary('2026-07-18')])
  })

  it('null without a status to write from, and asks for nothing', async () => {
    expect(await getTodayInsight(null, WORKOUT)).toBeNull()
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('hands back the cached verdict for today', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getTodayInsight(status(), WORKOUT)).toEqual(INSIGHT)
  })

  it('null when the cached verdict has gone stale, so the hero keeps its own copy', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getTodayInsight(status(), WORKOUT)).toBeNull()
  })

  it('keys the verdict on the facts it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)

    const context = buildTodayContext(status(), WORKOUT)
    expect(readVerifiedInsight).toHaveBeenCalledWith(TODAY_SURFACE, {
      hash: todayInsightHash(context),
      guard: todayInsightGuard(context),
    })
  })

  it('asks for a different verdict once the form moves', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ tsbNow: -22, status: 'overreaching', risk: 'high' }), WORKOUT)

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
  })

  it('asks for a different verdict once the day plans a different session', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status(), null)

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
  })

  // The hash moves overnight on its own - a day passes, the rolling week shifts -
  // and the guard is what decides whether yesterday's line may still be served.
  it('holds the guard while the form only drifts, so overnight copy survives', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ tsbNow: 12, ctlDelta: 3.1 }), WORKOUT)

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
    expect(first?.[1].guard).toBe(second?.[1].guard)
  })

  it('moves the guard once the tone badge would contradict the copy', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ status: 'overreaching', tsbNow: -22, risk: 'high' }), WORKOUT)

    const [go, hold] = readVerifiedInsight.mock.calls
    expect(go?.[1].guard).not.toBe(hold?.[1].guard)
  })

  it('moves the guard once the session the copy was written for has been run', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    // getTodayInsight builds its context against the real clock, so "already
    // run today" has to be dated off the same one.
    withHistory([summary(isoDate(new Date()))])
    await getTodayInsight(status(), WORKOUT)

    const [upcoming, completed] = readVerifiedInsight.mock.calls
    expect(upcoming?.[1].guard).not.toBe(completed?.[1].guard)
  })
})
