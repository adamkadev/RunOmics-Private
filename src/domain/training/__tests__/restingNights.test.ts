import { describe, expect, it } from 'vitest'
import { restingNights, type RecoveryNight } from '../recovery'

const night = (date: string, hrv: number | null, restingHr: number | null): RecoveryNight => ({ date, hrv, restingHr })

// Round 2, the owner's watch, worn only to run: Garmin's resting HR on those
// days is a warm-up's, 55 to 60 against a true 45 - and 142 on a hard day.
describe('restingNights', () => {
  it('keeps a resting HR only where the watch was worn through the night', () => {
    const nights = [
      night('2026-08-01', 62, 45),
      night('2026-08-02', 60, 46),
      night('2026-10-20', null, 58),
      night('2026-10-21', null, 142),
      night('2026-10-22', null, 60),
    ]
    expect(restingNights(nights)).toEqual([night('2026-08-01', 62, 45), night('2026-08-02', 60, 46)])
  })

  it('keeps an HRV night whose resting HR is missing', () => {
    expect(restingNights([night('2026-08-01', 62, null), night('2026-08-02', null, 58)])).toEqual([night('2026-08-01', 62, null)])
  })

  // The owner's watch has never been worn to sleep (a Fitbit is, at night):
  // a history with no HRV has no resting HR in it at all.
  it('keeps no resting HR from a watch never worn through a night', () => {
    expect(restingNights([night('2026-10-20', null, 58), night('2026-10-21', null, 142), night('2026-10-22', null, 60)])).toEqual([])
  })
})
