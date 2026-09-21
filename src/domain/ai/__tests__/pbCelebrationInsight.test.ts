import { describe, expect, it } from 'vitest'
import { celebratedRecord, pbCelebrationInsightHash } from '../pbCelebrationInsight'
import type { RecordEntry } from '@/application/usecases/GetRecords'

const NOW = new Date('2026-07-30T10:00:00')

const record: RecordEntry = {
  key: '5k',
  label: '5K',
  seconds: 1264,
  paceSecPerKm: 253,
  distanceKm: 5,
  activityId: 'act-1',
  date: '2026-07-29',
  official: false,
}

describe('celebratedRecord', () => {
  it('celebrates a record set within the window', () => {
    expect(celebratedRecord(record, NOW)).toBe(record)
  })

  it('ignores a record older than the window, so no quota is spent on it', () => {
    expect(celebratedRecord({ ...record, date: '2026-06-01' }, NOW)).toBeNull()
  })

  it('ignores a record with nothing to show', () => {
    expect(celebratedRecord({ ...record, seconds: null }, NOW)).toBeNull()
    expect(celebratedRecord({ ...record, activityId: null }, NOW)).toBeNull()
    expect(celebratedRecord(null, NOW)).toBeNull()
  })
})

describe('pbCelebrationInsightHash', () => {
  const hash = (entry: RecordEntry) => pbCelebrationInsightHash({ record: entry, previous: null })

  it('holds while the record does', () => {
    expect(hash(record)).toBe(hash({ ...record, date: '2026-07-28' }))
  })

  it('moves when a faster time lands', () => {
    expect(hash(record)).not.toBe(hash({ ...record, seconds: 1250 }))
  })

  it('moves when the mark it replaces is found', () => {
    expect(hash(record)).not.toBe(
      pbCelebrationInsightHash({ record, previous: { seconds: 1300, date: '2026-02-01' } })
    )
  })
})
