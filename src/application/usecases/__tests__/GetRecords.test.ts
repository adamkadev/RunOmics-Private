import { describe, it, expect } from 'vitest'
import { computeBestEfforts, getMostRecentRecord, getQualifiedEffortsByActivityId, type RecordEntry } from '../GetRecords'
import type { Activity } from '@/domain/activity/types'

const act = (id: string, date: string, bestEfforts: Record<string, number> | null, description = ''): Activity =>
  ({ id, date, bestEfforts, description } as Activity)

describe('computeBestEfforts', () => {
  it('returns the fastest time per effort key across activities', () => {
    const activities = [
      act('a1', '2026-01-01', { '5k': 1200 }),
      act('a2', '2026-02-01', { '5k': 1100, '10k': 2400 }),
    ]
    const best = computeBestEfforts(activities)
    expect(best.get('5k')).toMatchObject({ seconds: 1100, activityId: 'a2' })
    expect(best.get('10k')).toMatchObject({ seconds: 2400, activityId: 'a2' })
  })

  it('ignores activities without bestEfforts', () => {
    const activities = [act('a1', '2026-01-01', null)]
    expect(computeBestEfforts(activities).size).toBe(0)
  })

  it('ignores effort keys not in EFFORTS', () => {
    const activities = [act('a1', '2026-01-01', { '5k': 1200, unknown: 1 })]
    expect(computeBestEfforts(activities).has('unknown')).toBe(false)
  })
})

describe('getMostRecentRecord', () => {
  const record = (key: string, date: string | null): RecordEntry => ({
    key,
    label: key,
    seconds: 100,
    paceSecPerKm: 100,
    activityId: 'a',
    date,
    official: false,
  })

  it('returns the record with the latest date', () => {
    const records = [record('5k', '2026-01-01'), record('10k', '2026-03-01'), record('half', '2026-02-01')]
    expect(getMostRecentRecord(records)?.key).toBe('10k')
  })

  it('ignores records without a date', () => {
    const records = [record('5k', null), record('10k', '2026-03-01')]
    expect(getMostRecentRecord(records)?.key).toBe('10k')
  })

  it('returns null when no record has a date', () => {
    expect(getMostRecentRecord([record('5k', null)])).toBeNull()
  })
})

describe('getQualifiedEffortsByActivityId', () => {
  const record = (key: string, label: string, activityId: string | null): RecordEntry => ({
    key,
    label,
    seconds: 1,
    paceSecPerKm: 1,
    activityId,
    date: null,
    official: false,
  })

  it('labels the current record holder as rank 1', () => {
    const records: RecordEntry[] = [record('5k', '5K', 'a1'), record('10k', '10K', 'a1'), record('half', 'Half', 'a2')]
    const activities = [act('a1', '2026-01-01', { '5k': 1200, '10k': 2500 }), act('a2', '2026-01-05', { half: 6000 })]

    const result = getQualifiedEffortsByActivityId(records, activities)
    expect(result.a1).toEqual(
      expect.arrayContaining([
        { key: '5k', label: '5K', rank: 1 },
        { key: '10k', label: '10K', rank: 1 },
      ]),
    )
    expect(result.a2).toEqual(expect.arrayContaining([{ key: 'half', label: 'Half', rank: 1 }]))
  })

  it('ranks the next-best locally recorded efforts as #2/#3, skipping the record holder', () => {
    const records: RecordEntry[] = [record('5k', '5K', 'a1')]
    const activities = [
      act('a1', '2026-03-01', { '5k': 1000 }),
      act('a2', '2026-02-01', { '5k': 1100 }),
      act('a3', '2026-01-01', { '5k': 1200 }),
      act('a4', '2025-12-01', { '5k': 1300 }),
    ]

    const result = getQualifiedEffortsByActivityId(records, activities, 3)
    expect(result.a1).toEqual([{ key: '5k', label: '5K', rank: 1 }])
    expect(result.a2).toEqual([{ key: '5k', label: '5K', rank: 2 }])
    expect(result.a3).toEqual([{ key: '5k', label: '5K', rank: 3 }])
    expect(result.a4).toBeUndefined()
  })

  it('breaks ties by recency (newest activity keeps the better rank)', () => {
    const activities = [
      act('newer', '2026-02-01', { '5k': 1000 }),
      act('older', '2026-01-01', { '5k': 1000 }),
    ]
    const result = getQualifiedEffortsByActivityId([], activities, 2)
    expect(result.newer).toEqual([{ key: '5k', label: '5K', rank: 1 }])
    expect(result.older).toEqual([{ key: '5k', label: '5K', rank: 2 }])
  })
})
