import { describe, expect, it } from 'vitest'
import { restingDays, type RecoveryDay } from '../recovery'

const rested = (date: string, restingHr: number): RecoveryDay => ({ date, restingHr })

// Round 2: Garmin's resting HR is the lowest half hour the watch was worn. The
// owner's watch is worn only to run (a Fitbit at night): its resting HR is a
// warm-up's, 50 to 60 against a true 45. The second athlete's is worn all day
// but not to sleep: 59 to 70, on run days too.
describe('restingDays', () => {
  it('keeps no resting HR from a watch worn only to run', () => {
    const runs = new Set(['2026-10-16', '2026-10-18', '2026-10-21'])
    const days = [rested('2026-10-16', 58), rested('2026-10-18', 55), rested('2026-10-21', 60)]
    expect(restingDays(days, runs)).toEqual([])
  })

  it('keeps a watch worn all day but not to sleep, run days included', () => {
    const runs = new Set(['2026-10-16', '2026-10-18', '2026-10-21'])
    const days = [
      rested('2026-10-15', 59),
      rested('2026-10-16', 68),
      rested('2026-10-17', 68),
      rested('2026-10-18', 67),
      rested('2026-10-19', 61),
      rested('2026-10-20', 64),
      rested('2026-10-21', 67),
    ]
    expect(restingDays(days, runs)).toEqual(days)
  })

  it('drops a run day with fewer than two run-free days within a week of it', () => {
    const runs = new Set(['2026-10-21'])
    const days = [rested('2026-10-01', 61), rested('2026-10-02', 62), rested('2026-10-20', 64), rested('2026-10-21', 89)]
    expect(restingDays(days, runs)).toEqual(days.slice(0, 3))
  })
})
