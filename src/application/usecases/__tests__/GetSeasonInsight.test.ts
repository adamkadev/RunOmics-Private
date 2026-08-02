import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SeasonHeadlineData } from '../GetSeasonHeadline'
import { SEASON_SURFACE, seasonInsightGuard, seasonInsightHash } from '@/domain/ai/seasonInsight'

const { readVerifiedInsight } = vi.hoisted(() => ({ readVerifiedInsight: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { getSeasonInsight } = await import('../GetSeasonInsight')

const INSIGHT = { headline: 'A season built on volume', body: 'The base held all spring.' }

const data = (bullets: { tone: string; text: string }[]): SeasonHeadlineData =>
  ({ bullets }) as unknown as SeasonHeadlineData

const SEASON = data([
  { tone: 'positive', text: 'CTL up 12 since March' },
  { tone: 'caution', text: 'Two weeks without a key session' },
])

describe('getSeasonInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null without a season to write about, and asks for nothing', async () => {
    expect(await getSeasonInsight(null)).toBeNull()
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('hands back the cached take on the season', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getSeasonInsight(SEASON)).toEqual(INSIGHT)
  })

  it('null when the cached take no longer matches the season, so the card keeps its own title', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getSeasonInsight(SEASON)).toBeNull()
  })

  it('keys the take on the reads it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getSeasonInsight(SEASON)

    expect(readVerifiedInsight).toHaveBeenCalledWith(SEASON_SURFACE, {
      hash: seasonInsightHash(SEASON),
      guard: seasonInsightGuard(SEASON),
    })
  })

  it('asks for a different take once a read behind it moves', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getSeasonInsight(SEASON)
    await getSeasonInsight(data([{ tone: 'positive', text: 'CTL up 18 since March' }]))

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
  })

  // The reads drift with every sync, so the take has to outlive its own figures.
  // What it cannot outlive is a list that changed shape or flipped sign: the card
  // pairs each generated bullet with the read at that index and colors it from
  // that read's tone.
  it('holds the guard while a read only drifts', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getSeasonInsight(SEASON)
    await getSeasonInsight(
      data([
        { tone: 'positive', text: 'CTL up 18 since March' },
        { tone: 'caution', text: 'Two weeks without a key session' },
      ])
    )

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1].hash).not.toBe(second?.[1].hash)
    expect(first?.[1].guard).toBe(second?.[1].guard)
  })

  it('moves the guard once a read flips sign under the copy', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getSeasonInsight(SEASON)
    await getSeasonInsight(
      data([
        { tone: 'caution', text: 'CTL down 4 since March' },
        { tone: 'caution', text: 'Two weeks without a key session' },
      ])
    )

    const [gain, concern] = readVerifiedInsight.mock.calls
    expect(gain?.[1].guard).not.toBe(concern?.[1].guard)
  })

  it('moves the guard once the card has a different number of reads to pair', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getSeasonInsight(SEASON)
    await getSeasonInsight(
      data([
        { tone: 'positive', text: 'CTL up 12 since March' },
        { tone: 'caution', text: 'Two weeks without a key session' },
        { tone: 'positive', text: 'Easy pace 12s/km quicker' },
      ])
    )

    const [two, three] = readVerifiedInsight.mock.calls
    expect(two?.[1].guard).not.toBe(three?.[1].guard)
  })
})
