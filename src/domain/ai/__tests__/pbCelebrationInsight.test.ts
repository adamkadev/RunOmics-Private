import { describe, expect, it } from 'vitest'
import { celebratedRecord, pbCelebrationInsightHash, pbCelebrationInsightPrompt, PB_CELEBRATION_SYSTEM_INSTRUCTION } from '../pbCelebrationInsight'
import { shoeVerdictInsightPrompt, SHOE_VERDICT_SYSTEM_INSTRUCTION } from '../shoeVerdictInsight'
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

describe('pbCelebrationInsightPrompt (v4.16.4)', () => {
  it('says a first record is a first, and never asks for a mark that does not exist', () => {
    const prompt = pbCelebrationInsightPrompt({ record, previous: null }, [])

    expect(prompt).toContain('- No earlier mark at this distance: a first record')
    expect(PB_CELEBRATION_SYSTEM_INSTRUCTION).toContain('When none is given, this is the first time on record at this distance')
  })

  it('says how long the old mark stood in months, not a day count or an ISO date', () => {
    const prompt = pbCelebrationInsightPrompt({ record, previous: { seconds: 1300, date: '2026-02-01' } }, [])

    expect(prompt).toContain('- The mark it replaces: 21:40')
    expect(prompt).toContain('- That mark had stood for 6 months')
    expect(prompt).not.toContain('2026-02-01')
  })
})

describe('shoeVerdictInsightPrompt (v4.16.4)', () => {
  const shoe = { name: 'Pegasus', wearPercent: 104, kmPerWeek: 27 } as never

  it('never hands a pair past its limit "0 km left, about 0 weeks"', () => {
    const prompt = shoeVerdictInsightPrompt({ shoe, status: 'replace', kmLeft: 0, weeksRemaining: 0 }, [])

    expect(prompt).toContain('- Already past its kilometre limit')
    expect(prompt).not.toContain('0 weeks')
  })

  it('marks the kilometres left as printed, and keeps them out of the copy', () => {
    const prompt = shoeVerdictInsightPrompt({ shoe, status: 'watch', kmLeft: 301, weeksRemaining: 11 }, [])

    expect(prompt).toContain('- Kilometres left before the limit, printed on the page: 301')
    expect(prompt).toContain('- At 27 km a week, that is about 11 weeks')
    expect(SHOE_VERDICT_SYSTEM_INSTRUCTION).toContain('the kilometres left and the status label are already printed')
  })
})
