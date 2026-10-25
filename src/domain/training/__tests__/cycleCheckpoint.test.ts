import { describe, expect, it } from 'vitest'
import { preparationWeek } from '@/components/coaching/presentation'
import { checkpointCycle, easyHrAtPace, shiftDays, type EasyRunSample } from '../cycleCheckpoint'

describe('checkpointCycle', () => {
  it('counts a Thursday start in the Plan header’s Monday weeks, rates over the weeks already over', () => {
    expect(checkpointCycle('2026-10-15', '2026-10-25')).toEqual({
      mode: 'coach',
      number: 1,
      week: 2,
      complete: false,
      current: { start: '2026-10-12', end: '2027-01-03' },
      previous: { start: '2026-07-20', end: '2026-10-11' },
      asOf: '2026-10-25',
      completeWeeks: 1,
    })
  })

  it('agrees with the Plan header’s week on every day of two cycles', () => {
    const plan = { macrocycleStartDate: '2026-10-15', block: { startDate: '2026-10-15' } }
    for (let day = 7; day < 168; day += 1) {
      const date = shiftDays('2026-10-12', day)
      const cycle = checkpointCycle('2026-10-15', date)
      if (!cycle.complete) expect(cycle.week + (cycle.number! - 1) * 12).toBe(preparationWeek(plan, date))
    }
  })

  it('keeps the cycle just ended under review through the first week of the next', () => {
    const review = checkpointCycle('2026-10-15', '2027-01-08')
    expect(review).toMatchObject({ number: 1, week: 12, complete: true, asOf: '2027-01-03', completeWeeks: 12 })
    expect(checkpointCycle('2026-10-15', '2027-01-11')).toMatchObject({ number: 2, week: 2, completeWeeks: 1, previous: review.current })
  })

  it('falls back to the last 12 full weeks against the 12 before without a plan, or before it starts', () => {
    const rolling = { mode: 'rolling', complete: true, current: { start: '2026-08-03', end: '2026-10-25' }, previous: { start: '2026-05-11', end: '2026-08-02' } }
    expect(checkpointCycle(null, '2026-10-28')).toMatchObject(rolling)
    expect(checkpointCycle('2026-11-02', '2026-10-28')).toMatchObject(rolling)
  })
})

describe('easyHrAtPace', () => {
  const run = (paceSecPerKm: number, hr: number, apparentTempC: number | null = 10): EasyRunSample => ({ date: '2026-10-01', paceSecPerKm, hr, apparentTempC })

  it('takes the median heat-adjusted HR of the easy runs near the pace, leaving the others out', () => {
    expect(easyHrAtPace([run(348, 150), run(352, 152), run(355, 165, 30), run(400, 130)], 350)).toBe(150)
  })

  it('says nothing from fewer than three runs near the pace', () => {
    expect(easyHrAtPace([run(348, 150), run(352, 152), run(400, 130)], 350)).toBeNull()
  })
})
