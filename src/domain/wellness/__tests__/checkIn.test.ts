import { describe, expect, it } from 'vitest'
import { niggleEpisodes, readCheckIn, readCheckInConcerns, type CheckIn } from '../checkIn'

describe('readCheckIn', () => {
  it('keeps only the answers the check-in can give', () => {
    expect(readCheckIn({ sleep: 4, soreness: 9, stress: 2.5, mood: '5', ill: true, travel: 'yes', note: 'x', niggle: { site: 'calf', side: 'up', pain: 3, changesRun: false } }))
      .toEqual({ sleep: 4, ill: true, niggle: { site: 'calf', pain: 3 } })
    expect(readCheckIn({ niggle: { site: 'elbow', pain: 3 } })).toBeNull()
  })
})

describe('readCheckInConcerns', () => {
  it('leaves an ordinary or merely flat morning alone', () => {
    expect(readCheckInConcerns({ sleep: 2, soreness: 3, stress: 1, mood: 1 })).toBeNull()
    expect(readCheckInConcerns({ sleep: 4, niggle: { site: 'knee', pain: 3 } })).toBeNull()
    expect(readCheckInConcerns(null)).toBeNull()
  })

  it('eases off for moderate pain, a niggle that changes the run, or a poor night on sore legs', () => {
    expect(readCheckInConcerns({ niggle: { site: 'knee', pain: 4 } })?.tone).toBe('caution')
    expect(readCheckInConcerns({ niggle: { site: 'knee', pain: 2, changesRun: true } })?.tone).toBe('caution')
    expect(readCheckInConcerns({ sleep: 2, soreness: 2 })).toEqual({ tone: 'caution', concerns: [{ kind: 'sleepSoreness', sleep: 2, soreness: 2 }] })
  })

  it('rests for illness or severe pain, the gravest reason first', () => {
    const reading = readCheckInConcerns({ sleep: 1, soreness: 1, ill: true, niggle: { site: 'achilles', side: 'left', pain: 7 } })
    expect(reading?.tone).toBe('hold')
    expect(reading?.concerns.map((c) => c.kind)).toEqual(['ill', 'pain', 'sleepSoreness'])
  })
})

describe('niggleEpisodes', () => {
  it('joins reports of one site and side across skipped mornings, newest first', () => {
    const entries = new Map<string, CheckIn>([
      ['2026-09-01', { niggle: { site: 'calf', side: 'left', pain: 2 } }],
      ['2026-10-10', { niggle: { site: 'calf', side: 'left', pain: 3 } }],
      ['2026-10-13', { niggle: { site: 'calf', side: 'left', pain: 5, changesRun: true } }],
      ['2026-10-14', { niggle: { site: 'calf', side: 'right', pain: 2 } }],
      ['2026-10-15', { niggle: { site: 'calf', side: 'left', pain: 1 } }],
      ['2026-10-20', { niggle: { site: 'calf', side: 'left', pain: 2 } }],
    ])

    expect(niggleEpisodes(entries)).toEqual([
      { site: 'calf', side: 'left', from: '2026-10-20', to: '2026-10-20', daysReported: 1, peakPain: 2, lastPain: 2, daysChangingRun: 0 },
      { site: 'calf', side: 'left', from: '2026-10-10', to: '2026-10-15', daysReported: 3, peakPain: 5, lastPain: 1, daysChangingRun: 1 },
      { site: 'calf', side: 'right', from: '2026-10-14', to: '2026-10-14', daysReported: 1, peakPain: 2, lastPain: 2, daysChangingRun: 0 },
      { site: 'calf', side: 'left', from: '2026-09-01', to: '2026-09-01', daysReported: 1, peakPain: 2, lastPain: 2, daysChangingRun: 0 },
    ])
  })
})
