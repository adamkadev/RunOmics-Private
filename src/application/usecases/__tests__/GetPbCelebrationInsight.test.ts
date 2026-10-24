import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RecordEntry, TopEfforts } from '../GetRecords'
import { PB_CELEBRATION_SURFACE, pbCelebrationInsightHash } from '@/domain/ai/pbCelebrationInsight'

const { getTopEfforts, readVerifiedInsight } = vi.hoisted(() => ({
  getTopEfforts: vi.fn(),
  readVerifiedInsight: vi.fn(),
}))

vi.mock('../GetRecords', () => ({ getTopEfforts }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({ readVerifiedInsight }))

const { buildPbCelebrationContext, getPbCelebrationInsight } = await import('../GetPbCelebrationInsight')

const NOW = new Date('2026-07-20T09:00:00')
const INSIGHT = { headline: 'Two years of work, paid', body: 'That mark had stood since 2024.' }

function record(overrides: Partial<RecordEntry> = {}): RecordEntry {
  return {
    key: '5k',
    label: '5K',
    seconds: 1140,
    paceSecPerKm: 228,
    activityId: 'new',
    date: '2026-07-19',
    official: false,
    ...overrides,
  }
}

function withLeaderboard(entries: TopEfforts) {
  getTopEfforts.mockReturnValue(entries)
}

const effort = (activityId: string, seconds: number, date: string) => ({
  seconds,
  distanceKm: 5,
  activityId,
  date,
})

describe('buildPbCelebrationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('finds the mark the record replaced one row below it', () => {
    withLeaderboard({ '5k': [effort('new', 1140, '2026-07-19'), effort('old', 1200, '2024-05-04')] })

    expect(buildPbCelebrationContext(record()).previous).toEqual({ seconds: 1200, date: '2024-05-04' })
  })

  it('skips past the new record itself rather than comparing it to itself', () => {
    withLeaderboard({ '5k': [effort('new', 1140, '2026-07-19')] })

    expect(buildPbCelebrationContext(record()).previous).toBeNull()
  })

  it('null when this is the first time the distance has been run', () => {
    withLeaderboard({})

    expect(buildPbCelebrationContext(record()).previous).toBeNull()
  })

  it('reads only two rows deep, since the mark it replaced is the one below', () => {
    withLeaderboard({ '5k': [effort('new', 1140, '2026-07-19')] })
    buildPbCelebrationContext(record())

    expect(getTopEfforts).toHaveBeenCalledWith(undefined, 2)
  })

  it('carries the record itself through untouched', () => {
    withLeaderboard({})
    const fresh = record()

    expect(buildPbCelebrationContext(fresh).record).toBe(fresh)
  })
})

describe('getPbCelebrationInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withLeaderboard({ '5k': [effort('new', 1140, '2026-07-19'), effort('old', 1200, '2024-05-04')] })
  })

  it('null when there is no record on the board at all', async () => {
    expect(await getPbCelebrationInsight(null, NOW)).toBeNull()
    expect(readVerifiedInsight).not.toHaveBeenCalled()
  })

  it('null for a record set too long ago to still be celebrating', async () => {
    expect(await getPbCelebrationInsight(record({ date: '2026-07-01' }), NOW)).toBeNull()
  })

  it('null for a record with no time or no run behind it', async () => {
    expect(await getPbCelebrationInsight(record({ seconds: null }), NOW)).toBeNull()
    expect(await getPbCelebrationInsight(record({ activityId: null }), NOW)).toBeNull()
    expect(await getPbCelebrationInsight(record({ date: null }), NOW)).toBeNull()
  })

  it('hands back the cached word on a record just set', async () => {
    readVerifiedInsight.mockResolvedValue(INSIGHT)

    expect(await getPbCelebrationInsight(record(), NOW)).toEqual(INSIGHT)
  })

  it('keys the word on the record and the mark it replaced', async () => {
    readVerifiedInsight.mockResolvedValue(null)
    const fresh = record()
    await getPbCelebrationInsight(fresh, NOW)

    expect(readVerifiedInsight).toHaveBeenCalledWith(
      PB_CELEBRATION_SURFACE,
      pbCelebrationInsightHash(buildPbCelebrationContext(fresh))
    )
  })
})
