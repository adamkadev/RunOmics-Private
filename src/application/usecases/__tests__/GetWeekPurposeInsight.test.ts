import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentWeekPurpose } from '../GetCurrentWeekPurpose'
import { WEEK_PURPOSE_SURFACE, weekPurposeInsightHash } from '@/domain/ai/weekPurposeInsight'

const { readVerifiedInsight } = vi.hoisted(() => ({ readVerifiedInsight: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { getWeekPurposeInsight } = await import('../GetWeekPurposeInsight')

const INSIGHT = { headline: 'Sharpening week', body: 'Two quality sessions left before the taper.' }

function week(overrides: Partial<CurrentWeekPurpose> = {}): CurrentWeekPurpose {
  return {
    weekStart: '2026-07-20',
    planPhase: 'build',
    planned: { total: 5, key: 2 },
    adherence: { planned: 5, done: 3, percent: 60 },
    comparison: { percent: 112, level: 'normal' },
    distanceKm: 42.5,
    sessions: 3,
    keySessions: 1,
    hardPct: 18,
    remaining: [{ date: '2026-07-24', name: 'Threshold 3x8', type: 'Threshold' }],
    ...overrides,
  }
}

describe('getWeekPurposeInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null without a week to write about, and asks for nothing', async () => {
    expect(await getWeekPurposeInsight(null)).toBeNull()
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('hands back the cached line for the week', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getWeekPurposeInsight(week())).toEqual(INSIGHT)
  })

  it('null when the cached line has gone stale, so the banner keeps its title alone', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getWeekPurposeInsight(week())).toBeNull()
  })

  it('keys the line on the week it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    const current = week()
    await getWeekPurposeInsight(current)

    expect(readVerifiedInsight).toHaveBeenCalledWith(WEEK_PURPOSE_SURFACE, weekPurposeInsightHash(current))
  })

  it('asks for a different line once a session is run', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getWeekPurposeInsight(week())
    await getWeekPurposeInsight(week({ sessions: 4, distanceKm: 53.5, remaining: [] }))

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1]).not.toBe(second?.[1])
  })
})
