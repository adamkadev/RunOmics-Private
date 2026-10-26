import { describe, expect, it } from 'vitest'
import type { CoachState, CoachingPlan } from '@/domain/coaching/types'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { getCoachingReminder } from '../GetCoachingReminder'

const TODAY = '2026-09-30'

function repository(endDate: string, lastWeeklyReviewAt: string | null, currentPlan: CoachingPlan | null = plan()) {
  return {
    getCurrentPlan: () => (currentPlan ? { ...currentPlan, block: { ...currentPlan.block, endDate } } : null),
    getState: () => ({ lastWeeklyReviewAt, lastBootstrapAt: null } as unknown as CoachState),
  }
}

describe('getCoachingReminder', () => {
  it('says nothing while the block runs on and the reviews are current', () => {
    expect(getCoachingReminder(TODAY, repository('2026-11-01', '2026-09-28T09:00:00.000Z'))).toBeNull()
  })

  it('counts the days to a block that ends within the week', () => {
    const reminder = getCoachingReminder(TODAY, repository('2026-10-04', '2026-09-28T09:00:00.000Z'))

    expect(reminder).toEqual({ blockEndsInDays: 4, reviewOverdue: false, daysSinceReview: 2 })
  })

  it('leaves the block out once its last day has passed', () => {
    expect(getCoachingReminder(TODAY, repository('2026-09-27', '2026-09-28T09:00:00.000Z'))).toBeNull()
  })

  it('raises a review that is more than a week old', () => {
    const reminder = getCoachingReminder(TODAY, repository('2026-11-01', '2026-09-15T09:00:00.000Z'))

    expect(reminder).toEqual({ blockEndsInDays: null, reviewOverdue: true, daysSinceReview: 15 })
  })

  it('raises a block that has never been reviewed at all', () => {
    const reminder = getCoachingReminder(TODAY, repository('2026-11-01', null))

    expect(reminder).toEqual({ blockEndsInDays: null, reviewOverdue: true, daysSinceReview: null })
  })

  it('says nothing at all without a plan to renew', () => {
    expect(getCoachingReminder(TODAY, repository('2026-11-01', null, null))).toBeNull()
  })
})
