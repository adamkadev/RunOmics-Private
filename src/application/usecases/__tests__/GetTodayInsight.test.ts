import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { TrainingStatus } from '../GetTrainingStatus'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import { TODAY_SURFACE, todayInsightGuard, todayInsightHash } from '@/domain/ai/todayInsight'

const { getActivitySummaries, readStoredInsight, getTodayPlannedWorkout, getTodayPrescription } = vi.hoisted(() => ({
  getActivitySummaries: vi.fn(),
  readStoredInsight: vi.fn(),
  getTodayPlannedWorkout: vi.fn(),
  getTodayPrescription: vi.fn(),
}))

vi.mock('../GetActivities', () => ({ getActivitySummaries }))
vi.mock('../GetPlannedWorkouts', () => ({ getTodayPlannedWorkout }))
vi.mock('@/application/coaching/GetCoachingView', () => ({ getTodayPrescription }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readStoredInsight }))

const { buildTodayContext, getTodayInsight, todayInsightSession } = await import('../GetTodayInsight')

const TODAY = '2026-07-20'
const INSIGHT = { headline: 'Fresh legs today', body: 'Form is back above zero, so the tempo can be honest.' }
const verified = { insight: INSIGHT, generatedAt: '2026-07-20T05:00:00.000Z', verified: true }
const writtenAt = (generatedAt: string) => ({ insight: INSIGHT, generatedAt, verified: false })

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
    ctlDeltaShown: 1.2,
    atlDelta: -2.1,
    tsbDelta: 3.4,
    ctlPeak: 60,
    source: 'garmin',
    buildingBack: false,
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
    expect(buildTodayContext(status(), null, TODAY).tone).toBe('go')
    expect(buildTodayContext(status({ status: 'overreaching' }), null, TODAY).tone).toBe('hold')
  })

  it("carries this week's training and the last run, which is what makes the copy specific", () => {
    // TODAY is a Monday, so Saturday's and Wednesday's runs were last week's.
    const context = buildTodayContext(status(), null, TODAY)

    expect(context.recent).toMatchObject({ weekRuns: 0, weekKm: 0 })
    expect(context.recent.lastRun).toEqual({ type: 'Base', daysAgo: 2, distanceKm: 10 })
  })

  it('carries the planned session, or the absence of one', () => {
    expect(buildTodayContext(status(), WORKOUT, TODAY).plannedWorkout).toBe(WORKOUT)
    expect(buildTodayContext(status(), null, TODAY).plannedWorkout).toBeNull()
  })

  it('never looks past the day it is built for', () => {
    withHistory([summary('2026-07-25'), summary('2026-07-18')])

    expect(buildTodayContext(status(), null, TODAY).recent.lastRun?.daysAgo).toBe(2)
  })
})

describe('getTodayInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withHistory([summary('2026-07-18')])
  })

  it('null without a status to write from, and asks for nothing', async () => {
    expect(await getTodayInsight(null, WORKOUT)).toBeNull()
    expect(readStoredInsight).not.toHaveBeenCalled()
  })

  it('hands back the cached verdict for today', async () => {
    readStoredInsight.mockResolvedValue(verified)

    expect(await getTodayInsight(status(), WORKOUT)).toEqual(INSIGHT)
  })

  it('null when nothing is stored, so the hero keeps its own copy', async () => {
    readStoredInsight.mockResolvedValue(null)

    expect(await getTodayInsight(status(), WORKOUT)).toBeNull()
  })

  it("shows yesterday's card, marked, until today's is written - and nothing older", async () => {
    readStoredInsight.mockResolvedValue(writtenAt('2026-07-19T12:00:00.000Z'))
    expect(await getTodayInsight(status(), WORKOUT, TODAY)).toEqual({ ...INSIGHT, yesterday: true })

    readStoredInsight.mockResolvedValue(writtenAt('2026-07-17T12:00:00.000Z'))
    expect(await getTodayInsight(status(), WORKOUT, TODAY)).toBeNull()
  })

  it('reads the stored card once, whether it is today\'s or yesterday\'s', async () => {
    readStoredInsight.mockResolvedValue(writtenAt('2026-07-19T12:00:00.000Z'))
    await getTodayInsight(status(), WORKOUT, TODAY)
    expect(readStoredInsight).toHaveBeenCalledTimes(1)
  })

  it('keys the verdict on the facts it was written from', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)

    const context = buildTodayContext(status(), WORKOUT)
    expect(readStoredInsight).toHaveBeenCalledWith(TODAY_SURFACE, {
      hash: todayInsightHash(context),
      guard: todayInsightGuard(context),
    })
  })

  it('asks for a different verdict once the form moves', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ tsbNow: -22, status: 'overreaching', risk: 'high' }), WORKOUT)

    const [first, second] = readStoredInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
  })

  it('asks for a different verdict once the day plans a different session', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status(), null)

    const [first, second] = readStoredInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
  })

  it('holds the guard while the form only drifts, so overnight copy survives', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ tsbNow: 12, ctlDelta: 3.1 }), WORKOUT)

    const [first, second] = readStoredInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
    expect(first?.[1].guard).toBe(second?.[1].guard)
  })

  it('moves the guard once the tone badge would contradict the copy', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT)
    await getTodayInsight(status({ status: 'overreaching', tsbNow: -22, risk: 'high' }), WORKOUT)

    const [go, hold] = readStoredInsight.mock.calls
    expect(go?.[1].guard).not.toBe(hold?.[1].guard)
  })

  it('moves the guard once the session the copy was written for has been run', async () => {
    readStoredInsight.mockResolvedValue(null)
    await getTodayInsight(status(), WORKOUT, TODAY)
    withHistory([summary(TODAY)])
    await getTodayInsight(status(), WORKOUT, TODAY)

    const [upcoming, completed] = readStoredInsight.mock.calls
    expect(upcoming?.[1].guard).not.toBe(completed?.[1].guard)
  })
})

describe('todayInsightSession', () => {
  const PRESCRIPTION = {
    id: 'w-42',
    revision: 1,
    date: '2026-07-20',
    type: 'threshold' as const,
    title: 'Threshold 3 x 1600m',
    description: 'Three by a mile at threshold.',
    status: 'prescribed' as const,
    totalDurationSeconds: 3060,
    totalDistanceMeters: 9700,
    blocks: [],
    provenance: { source: 'gemini' as const, trigger: 'weekly' as const, createdAt: '2026-07-19T06:00:00Z' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getTodayPrescription.mockReturnValue(null)
    getTodayPlannedWorkout.mockResolvedValue(null)
  })

  it('names the session the plan prescribed, not what the watch called it', async () => {
    getTodayPrescription.mockReturnValue(PRESCRIPTION)
    getTodayPlannedWorkout.mockResolvedValue({ date: '2026-07-20', name: 'RUNOMICS-W3-THU' })

    expect(await todayInsightSession(TODAY)).toEqual({
      date: '2026-07-20',
      name: 'Threshold 3 x 1600m',
      type: 'Threshold',
      durationSecs: 3060,
      distanceM: 9700,
    })
  })

  it('leaves out a duration and distance the prescription never set', async () => {
    const open = { ...PRESCRIPTION }
    delete (open as Partial<typeof PRESCRIPTION>).totalDurationSeconds
    delete (open as Partial<typeof PRESCRIPTION>).totalDistanceMeters
    getTodayPrescription.mockReturnValue(open)

    const session = await todayInsightSession(TODAY)
    expect(session).not.toHaveProperty('durationSecs')
    expect(session).not.toHaveProperty('distanceM')
  })

  it('falls back to the Garmin entry when no plan prescribes today', async () => {
    getTodayPlannedWorkout.mockResolvedValue(WORKOUT)
    expect(await todayInsightSession(TODAY)).toBe(WORKOUT)
  })

  it('is null on a day with neither, so the verdict speaks to a rest day', async () => {
    expect(await todayInsightSession(TODAY)).toBeNull()
  })

  describe("on the athlete's date, not the server's", () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    })

    it('asks the plan and the watch about the same day the page shows', async () => {
      // 00:53 on Monday 19 October in Luxembourg: still Sunday on a UTC server.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-18T22:53:00Z'))
      vi.stubEnv('NEXT_PUBLIC_TIME_ZONE', 'Europe/Luxembourg')

      await todayInsightSession()
      expect(getTodayPrescription).toHaveBeenCalledWith('2026-10-19')
      expect(getTodayPlannedWorkout).toHaveBeenCalledWith('2026-10-19')
    })
  })

  it('hashes the same context the generator wrote, so a prescribed day still resolves', async () => {
    getTodayPrescription.mockReturnValue(PRESCRIPTION)
    withHistory([summary('2026-07-18')])
    readStoredInsight.mockResolvedValue(verified)

    const session = await todayInsightSession(TODAY)
    expect(await getTodayInsight(status(), session)).toEqual(INSIGHT)

    // Both sides default `now`, exactly as the page and the generator do.
    const context = buildTodayContext(status(), session)
    expect(readStoredInsight).toHaveBeenCalledWith(TODAY_SURFACE, {
      hash: todayInsightHash(context),
      guard: todayInsightGuard(context),
    })
  })
})
