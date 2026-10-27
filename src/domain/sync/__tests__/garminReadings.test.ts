import { describe, expect, it } from 'vitest'
import { isCurrentGarminReading } from '../garminReadings'

describe('isCurrentGarminReading', () => {
  it('keeps a training status up to three days old and drops it on the fourth', () => {
    expect(isCurrentGarminReading('trainingStatus', '2026-10-24', '2026-10-27')).toBe(true)
    expect(isCurrentGarminReading('trainingStatus', '2026-10-23', '2026-10-27')).toBe(false)
  })

  it('keeps a threshold pace for eight weeks', () => {
    expect(isCurrentGarminReading('thresholdPace', '2026-09-01', '2026-10-27')).toBe(true)
    expect(isCurrentGarminReading('thresholdPace', '2026-08-31', '2026-10-27')).toBe(false)
  })

  it('keeps race predictions for a fortnight', () => {
    expect(isCurrentGarminReading('racePrediction', '2026-10-13', '2026-10-27')).toBe(true)
    expect(isCurrentGarminReading('racePrediction', '2026-10-12', '2026-10-27')).toBe(false)
  })

  it('reads a timestamp by its day', () => {
    expect(isCurrentGarminReading('trainingStatus', '2026-10-24T23:59:00Z', '2026-10-27')).toBe(true)
  })

  it('never counts an undated or unreadable reading as current', () => {
    expect(isCurrentGarminReading('racePrediction', null, '2026-10-27')).toBe(false)
    expect(isCurrentGarminReading('racePrediction', undefined, '2026-10-27')).toBe(false)
    expect(isCurrentGarminReading('racePrediction', 'soon', '2026-10-27')).toBe(false)
  })
})
