import { describe, expect, it } from 'vitest'
import { garminScheduleStatus } from '../matching'
import { workout } from './fixtures'

describe('coach prescription versus Garmin schedule', () => {
  it('keeps an absent Garmin workout separate', () => {
    expect(garminScheduleStatus(workout(), null)).toBe('not_scheduled')
  })

  it('matches compatible type and totals', () => {
    expect(garminScheduleStatus(workout(), {
      date: '2026-09-09', name: 'Threshold', type: 'Threshold', durationSecs: 3_500,
    })).toBe('scheduled_match')
  })

  it('flags a materially different scheduled workout', () => {
    expect(garminScheduleStatus(workout(), {
      date: '2026-09-09', name: 'Easy', type: 'Base', durationSecs: 1_800,
    })).toBe('scheduled_different')
  })

  it('does not claim a match when Garmin exposes no comparable details', () => {
    const prescription = workout({ totalDurationSeconds: undefined, totalDistanceMeters: undefined })
    expect(garminScheduleStatus(prescription, { date: prescription.date, name: prescription.title, type: 'Threshold' })).toBe('scheduled_unknown')
  })
})
