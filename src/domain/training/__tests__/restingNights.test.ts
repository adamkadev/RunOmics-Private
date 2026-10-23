import { describe, expect, it } from 'vitest'
import { restingNights, type RecoveryNight } from '../recovery'

const night = (date: string, hrv: number | null, restingHr: number | null): RecoveryNight => ({ date, hrv, restingHr })

// Garmin's resting HR is the lowest half hour the watch was worn: a watch worn
// only to run reads a warm-up's 50 to 60 against a true 45.
describe('restingNights', () => {
  it('keeps no resting HR from a watch worn only to run', () => {
    const runs = new Set(['2026-10-16', '2026-10-18', '2026-10-21'])
    const nights = [night('2026-10-16', null, 58), night('2026-10-18', null, 55), night('2026-10-21', null, 60)]
    expect(restingNights(nights, runs)).toEqual([])
  })

  it('keeps a watch worn all day but not to sleep, run days included', () => {
    const runs = new Set(['2026-10-16', '2026-10-18', '2026-10-21'])
    const nights = [
      night('2026-10-15', null, 59),
      night('2026-10-16', null, 68),
      night('2026-10-17', null, 68),
      night('2026-10-18', null, 67),
      night('2026-10-19', null, 61),
      night('2026-10-20', null, 64),
      night('2026-10-21', null, 67),
    ]
    expect(restingNights(nights, runs)).toEqual(nights)
  })

  it('drops a run day with fewer than two run-free days within a week of it', () => {
    const runs = new Set(['2026-10-21'])
    const nights = [night('2026-10-01', null, 61), night('2026-10-02', null, 62), night('2026-10-20', null, 64), night('2026-10-21', null, 89)]
    expect(restingNights(nights, runs)).toEqual(nights.slice(0, 3))
  })

  it('keeps any night the watch was worn through, run or not', () => {
    const runs = new Set(['2026-08-01', '2026-10-21'])
    const nights = [night('2026-08-01', 62, 45), night('2026-08-02', 60, null), night('2026-10-21', null, 58)]
    expect(restingNights(nights, runs)).toEqual(nights.slice(0, 2))
  })
})
