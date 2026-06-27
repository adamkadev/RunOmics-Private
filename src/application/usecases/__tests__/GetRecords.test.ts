import { describe, it, expect } from 'vitest'
import { computeBestEfforts, getMostRecentRecord, getPrLabelsByActivityId, type RecordEntry } from '../GetRecords'
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

describe('getPrLabelsByActivityId', () => {
  it('groups record labels by activityId', () => {
    const records: RecordEntry[] = [
      { key: '5k', label: '5K', seconds: 1, paceSecPerKm: 1, activityId: 'a1', date: null, official: false },
      { key: '10k', label: '10K', seconds: 1, paceSecPerKm: 1, activityId: 'a1', date: null, official: false },
      { key: 'half', label: 'Half', seconds: 1, paceSecPerKm: 1, activityId: 'a2', date: null, official: false },
      { key: 'marathon', label: 'Marathon', seconds: null, paceSecPerKm: null, activityId: null, date: null, official: false },
    ]
    expect(getPrLabelsByActivityId(records)).toEqual({
      a1: ['5K', '10K'],
      a2: ['Half'],
    })
  })
})
