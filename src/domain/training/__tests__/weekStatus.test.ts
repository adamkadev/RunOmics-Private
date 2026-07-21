import { describe, it, expect } from 'vitest'
import { weekTrainingStatus } from '../weekStatus'
import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'

const WEEK = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']

function calendar(...statuses: (TrainingStatusType | undefined)[]): Record<string, TrainingStatusType> {
  const map: Record<string, TrainingStatusType> = {}
  statuses.forEach((status, i) => {
    const date = WEEK[i]
    if (status && date) map[date] = status
  })
  return map
}

describe('weekTrainingStatus', () => {
  it('names the week from the status covering the most days', () => {
    // The real week of 22-28 June as Garmin recorded it.
    const result = weekTrainingStatus(
      WEEK,
      calendar('productive', 'maintaining', 'maintaining', 'maintaining', 'maintaining', 'recovery', 'recovery')
    )
    expect(result).toBe('maintaining')
  })

  it('breaks a tie with the status the week ended on', () => {
    const result = weekTrainingStatus(
      WEEK,
      calendar('productive', 'productive', 'productive', undefined, 'recovery', 'recovery', 'recovery')
    )
    expect(result).toBe('recovery')
  })

  it('returns null when the watch rated fewer than three days', () => {
    expect(weekTrainingStatus(WEEK, calendar('productive', undefined, 'productive'))).toBeNull()
  })

  it('returns null for a week with no reading at all', () => {
    expect(weekTrainingStatus(WEEK, {})).toBeNull()
  })
})
