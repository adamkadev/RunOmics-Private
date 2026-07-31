import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalyticsTabFacts } from '../GetAnalyticsTabFacts'
import { analyticsTabInsightHash } from '@/domain/ai/analyticsTabInsight'

const { readVerifiedInsight } = vi.hoisted(() => ({ readVerifiedInsight: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { getAnalyticsTabInsights } = await import('../GetAnalyticsTabInsights')

const INSIGHT = { headline: 'Fitness is holding', body: 'Four weeks of steady load.' }

function facts(overrides: Partial<AnalyticsTabFacts> = {}): AnalyticsTabFacts {
  return {
    fitness: ['CTL 62, up 3 over four weeks'],
    performance: ['5K best 19:12, three weeks ago'],
    volume: ['52 km last week'],
    health: ['Easy/hard split 82/18'],
    ...overrides,
  }
}

describe('getAnalyticsTabInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('answers every tab that has a fresh line waiting', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(Object.keys(await getAnalyticsTabInsights(facts()))).toEqual([
      'fitness',
      'performance',
      'volume',
      'health',
    ])
  })

  it('leaves out a tab whose cached line has gone stale', async () => {
    readVerifiedInsight.mockImplementation(async (surface: string) =>
      surface === 'analyticsTab_volume' ? INSIGHT : null
    )

    expect(await getAnalyticsTabInsights(facts())).toEqual({ volume: INSIGHT })
  })

  it('never asks for a tab that has nothing to say', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)
    await getAnalyticsTabInsights(facts({ health: [] }))

    expect(readVerifiedInsight).toHaveBeenCalledTimes(3)
    expect(readVerifiedInsight).not.toHaveBeenCalledWith('analyticsTab_health', expect.anything())
  })

  it('reads each tab from its own document', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getAnalyticsTabInsights(facts())

    expect(readVerifiedInsight.mock.calls.map(([surface]) => surface)).toEqual([
      'analyticsTab_fitness',
      'analyticsTab_performance',
      'analyticsTab_volume',
      'analyticsTab_health',
    ])
  })

  it('keys the line on the reads it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    const input = facts()
    await getAnalyticsTabInsights(input)

    expect(readVerifiedInsight).toHaveBeenCalledWith(
      'analyticsTab_fitness',
      analyticsTabInsightHash('fitness', input.fitness)
    )
  })

  it('empty when the screen has no reads behind it at all', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(
      await getAnalyticsTabInsights({ fitness: [], performance: [], volume: [], health: [] })
    ).toEqual({})
  })
})
