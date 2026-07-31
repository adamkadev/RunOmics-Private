import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ShoeVerdictContext } from '@/domain/ai/shoeVerdictInsight'
import { shoeVerdictInsightHash, shoeVerdictSurface } from '@/domain/ai/shoeVerdictInsight'

const { readVerifiedInsight } = vi.hoisted(() => ({ readVerifiedInsight: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { getShoeVerdictInsight } = await import('../GetShoeVerdictInsight')

const INSIGHT = { headline: 'Time to shop', body: 'Six weeks of running left in these.' }

function context(overrides: Partial<ShoeVerdictContext> = {}): ShoeVerdictContext {
  return {
    shoe: { gearId: 'daily', name: 'Pegasus', wearPercent: 82, kmPerWeek: 28 },
    status: 'watch',
    kmLeft: 144,
    weeksRemaining: 5,
    ...overrides,
  } as ShoeVerdictContext
}

describe('getShoeVerdictInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hands back the cached verdict on the pair', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getShoeVerdictInsight(context())).toEqual(INSIGHT)
  })

  it('null when the cached verdict has gone stale, so the card keeps its own line', async () => {
    readVerifiedInsight.mockResolvedValue(null)

    expect(await getShoeVerdictInsight(context())).toBeNull()
  })

  it('gives each pair its own document', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getShoeVerdictInsight(context())

    expect(readVerifiedInsight).toHaveBeenCalledWith('shoeVerdict_daily', expect.any(String))
  })

  it('keys the verdict on the wear it was written from', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    const worn = context()
    await getShoeVerdictInsight(worn)

    expect(readVerifiedInsight).toHaveBeenCalledWith(shoeVerdictSurface('daily'), shoeVerdictInsightHash(worn))
  })

  it('keeps the same verdict while wear moves inside its band', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getShoeVerdictInsight(context({ shoe: { ...context().shoe, wearPercent: 81 } }))
    await getShoeVerdictInsight(context({ shoe: { ...context().shoe, wearPercent: 82 } }))

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1]).toBe(second?.[1])
  })

  it('asks for a different verdict once the pair crosses into replace', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    await getShoeVerdictInsight(context())
    await getShoeVerdictInsight(context({ status: 'replace', kmLeft: 12, weeksRemaining: 0 }))

    const [first, second] = readVerifiedInsight.mock.calls
    expect(first?.[1]).not.toBe(second?.[1])
  })
})
