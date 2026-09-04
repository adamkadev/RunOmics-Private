import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { CoachingAdvisor } from '@/application/ports/CoachingAdvisor'
import type { CoachDecision, CoachState, CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import { buildCoachingContext, coachingContextHash, type CoachingContextInput } from '../context'
import { applyCoachingProposal, createBootstrapProposal, createPostActivityProposal, createWeeklyReviewProposal } from '../workflows'
import { plan } from '@/domain/coaching/__tests__/fixtures'

class MemoryRepository implements CoachingRepository {
  plan: CoachingPlan | null = null
  state: CoachState | null = null
  decisions: CoachDecision[] = []
  evaluations: WorkoutEvaluation[] = []
  getCurrentPlan = () => this.plan
  saveCurrentPlan = (value: CoachingPlan) => { this.plan = value }
  getState = () => this.state
  saveState = (value: CoachState) => { this.state = value }
  getDecisions = () => this.decisions
  getDecision = (id: string) => this.decisions.find((item) => item.id === id) ?? null
  saveDecision = (value: CoachDecision) => { this.decisions = [...this.decisions.filter((item) => item.id !== value.id), value] }
  getEvaluations = () => this.evaluations
  getEvaluationForActivity = (id: string) => this.evaluations.find((item) => item.activityId === id) ?? null
  saveEvaluation = (value: WorkoutEvaluation) => { this.evaluations = [...this.evaluations.filter((item) => item.id !== value.id), value] }
}

const latestActivity = {
  id: 'activity-1',
  date: '2026-09-09',
  type: 'Threshold',
  distanceKm: 10,
  durationSeconds: 3_100,
  paceSecPerKm: 268,
  avgHeartRate: 170,
  rpe: 7,
  aerTrainingEffect: 3.5,
  anaTrainingEffect: 0.5,
  splits: null,
} as Activity

function contextInput(currentPlan: CoachingPlan | null): CoachingContextInput {
  return {
    activities: [latestActivity],
    plan: currentPlan,
    athlete: { thresholdPaceSecPerKm: 270, lthrBpm: 175 },
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: 50,
    racePredictions: null,
    goals: [{ year: 2026, annualDistanceKm: 1_500, targets: [{ distance: '10K', targetSeconds: 2_400 }] }],
    personalBests: [],
    upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }],
  }
}

function ids() {
  let value = 0
  return () => `generated-${++value}`
}

function fourWeekPlan(): CoachingPlan {
  const draft = plan()
  return {
    ...draft,
    block: { ...draft.block, endDate: '2026-10-04' },
    weeks: [
      ...draft.weeks,
      {
        id: 'week-3', index: 3, startDate: '2026-09-21', endDate: '2026-09-27', focus: 'Specific endurance',
        workouts: [{ ...draft.weeks[1]!.workouts[0]!, id: 'workout-week-3', date: '2026-09-22' }],
      },
      {
        id: 'week-4', index: 4, startDate: '2026-09-28', endDate: '2026-10-04', focus: 'Absorb the block',
        workouts: [{ ...draft.weeks[1]!.workouts[0]!, id: 'workout-week-4', date: '2026-09-29' }],
      },
    ],
  }
}

describe('coaching workflows', () => {
  it('bootstraps a normalized four-week plan and persists only on apply', async () => {
    const repository = new MemoryRepository()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => fourWeekPlan(),
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')
    const proposal = await createBootstrapProposal(context, [2, 3], {
      repository,
      advisor,
      id: ids(),
      now: () => new Date('2026-09-07T08:00:00Z'),
    })

    expect(repository.getCurrentPlan()).toBeNull()
    expect(proposal.proposedPlan).toMatchObject({ revision: 1, targetEvent: { name: 'Autumn 10K' } })
    applyCoachingProposal(proposal, repository, coachingContextHash(context))
    expect(repository.getCurrentPlan()?.revision).toBe(1)
    expect(repository.getState()?.lastBootstrapAt).toBe(proposal.createdAt)
  })

  it('records a KEEP evaluation without changing the plan revision', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({
        outcome: 'KEEP',
        reasonCodes: ['SESSION_COMPLETED'],
        summary: 'Session completed as intended.',
        evidence: [{ code: 'PACE_IN_RANGE', message: 'Pace remained in range.' }],
        changes: [],
      }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')
    const proposal = await createPostActivityProposal(context, latestActivity, {
      repository,
      advisor,
      id: ids(),
      now: () => new Date('2026-09-09T09:00:00Z'),
    })

    expect(proposal.evaluation).toMatchObject({ activityId: latestActivity.id, matchStatus: 'matched' })
    applyCoachingProposal(proposal, repository, coachingContextHash(context))
    expect(repository.plan?.revision).toBe(1)
    expect(repository.evaluations).toHaveLength(1)
    expect(repository.decisions[0]?.outcome).toBe('KEEP')
  })

  it('rejects stale proposals without writing anything', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({ outcome: 'KEEP', reasonCodes: ['OK'], summary: 'Keep going.', evidence: [], changes: [] }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')
    const proposal = await createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids() })
    expect(() => applyCoachingProposal(proposal, repository, 'different-context')).toThrow(/context changed/)
    expect(repository.decisions).toEqual([])
    expect(repository.evaluations).toEqual([])
  })

  it('applies an adjustment only to a future prescription and increments both revisions once', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const changed = { ...repository.plan.weeks[1]!.workouts[0]!, title: 'Easy run shortened', totalDurationSeconds: 2_400 }
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({
        outcome: 'ADJUST', reasonCodes: ['FATIGUE'], summary: 'Reduce the next easy run.', evidence: [],
        changes: [{ kind: 'upsert_workout', workoutId: changed.id, workout: changed }],
      }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')
    const proposal = await createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids() })

    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))
    const adjusted = result.weeks.flatMap((week) => week.workouts).find((item) => item.id === changed.id)
    expect(result.revision).toBe(2)
    expect(adjusted).toMatchObject({ id: changed.id, revision: 2, status: 'adjusted', title: 'Easy run shortened' })
    expect(result.weeks[0]!.workouts[0]).toEqual(plan().weeks[0]!.workouts[0])
  })

  it('replans only the future horizon while preserving unchanged prescriptions and their revisions', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const existingFuture = repository.plan.weeks[1]!.workouts[0]!
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => ({
        outcome: 'REPLAN', reasonCodes: ['ROLLING_HORIZON'], summary: 'Extend the rolling horizon.', evidence: [],
        changes: [{ kind: 'replace_future', effectiveDate: '2026-09-14', weeks: [{ ...repository.plan!.weeks[1]!, workouts: [existingFuture] }] }],
      }),
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-14')
    const proposal = await createWeeklyReviewProposal(context, { repository, advisor, id: ids() })
    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(result.revision).toBe(2)
    expect(result.weeks[0]!.workouts[0]).toEqual(plan().weeks[0]!.workouts[0])
    expect(result.weeks[1]!.workouts[0]).toEqual(existingFuture)
    expect(repository.state?.lastWeeklyReviewAt).toBe(proposal.createdAt)
  })

  it('does not write when advisor output is invalid', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({
        outcome: 'KEEP', reasonCodes: [], summary: '', evidence: [], changes: [],
      }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')

    await expect(createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids() })).rejects.toThrow()
    expect(repository.plan).toEqual(plan())
    expect(repository.decisions).toEqual([])
    expect(repository.evaluations).toEqual([])
  })

  it('never lets a late activity evaluation adjust a now-past prescription', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const futureAtActivityTime = repository.plan.weeks[1]!.workouts[0]!
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({
        outcome: 'ADJUST', reasonCodes: ['LATE_REVIEW'], summary: 'Try to change an old session.', evidence: [],
        changes: [{ kind: 'upsert_workout', workoutId: futureAtActivityTime.id, workout: { ...futureAtActivityTime, title: 'Too late' } }],
      }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')

    await expect(createPostActivityProposal(context, latestActivity, {
      repository, advisor, id: ids(), now: () => new Date('2026-09-20T08:00:00Z'),
    })).rejects.toThrow(/past prescriptions are immutable/)
    expect(repository.plan).toEqual(plan())
    expect(repository.decisions).toEqual([])
  })
})
