import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WeeklyDigest } from '../GetWeeklyDigest'
import { WEEKLY_REVIEW_SURFACE, weeklyReviewInsightHash } from '@/domain/ai/weeklyReviewInsight'

const { readVerifiedInsight } = vi.hoisted(() => ({ readVerifiedInsight: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { getWeeklyReviewInsight } = await import('../GetWeeklyReviewInsight')

const INSIGHT = { headline: 'A solid week', body: 'Volume held and the hard share stayed honest.' }

function digest(overrides: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    totals: { weekNumber: 202630, distanceKm: 52.4, sessions: 5, hardPct: 18 },
    review: [{ key: 'volume', severity: 'positive', text: 'Highest week of the block' }],
    remainder: { days: 2, plannedSessions: 1 },
    lastWeek: { distanceKm: 46.1, sessions: 4 },
    ...overrides,
  } as unknown as WeeklyDigest
}

describe('getWeeklyReviewInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null without a week to review, and asks for nothing', async () => {
    expect(await getWeeklyReviewInsight(null)).toBeNull()
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('hands back the cached review of the week', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getWeeklyReviewInsight(digest())).toEqual(INSIGHT)
  })

  it('null when the cached review has gone stale, so the card keeps its bullets alone', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getWeeklyReviewInsight(digest())).toBeNull()
  })

  it('keys the review on the week it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    const week = digest()
    await getWeeklyReviewInsight(week)

    expect(readVerifiedInsight).toHaveBeenCalledWith(WEEKLY_REVIEW_SURFACE, weeklyReviewInsightHash(week))
  })

  it('asks for a different review once the week moves on', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getWeeklyReviewInsight(digest())
    await getWeeklyReviewInsight(
      digest({ totals: { weekNumber: 202630, distanceKm: 63.8, sessions: 6, hardPct: 21 } as WeeklyDigest['totals'] })
    )

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1]).not.toBe(second?.[1])
  })
})
