import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { BootstrapRequest, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachDecision, CoachState, CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
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

function fourWeekPlan(): CoachingPlanDraft {
  const draft = plan()
  const persistent = {
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
  return {
    name: persistent.block.name,
    focus: persistent.block.focus,
    weeks: persistent.weeks.map((week) => ({
      startDate: week.startDate,
      endDate: week.endDate,
      focus: week.focus,
      workouts: week.workouts.map((workout) => ({
        date: workout.date,
        type: workout.type,
        title: workout.title,
        description: workout.description,
        blocks: workout.blocks,
        ...(workout.notes ? { notes: workout.notes } : {}),
      })),
    })),
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function draftThrough(request: BootstrapRequest): CoachingPlanDraft {
  const weeks: CoachingPlanDraft['weeks'] = []
  let startDate = request.context.referenceDate
  let index = 1
  while (startDate <= request.horizonEndDate) {
    const sevenDayEnd = addDays(startDate, 6)
    weeks.push({
      startDate,
      endDate: sevenDayEnd < request.horizonEndDate ? sevenDayEnd : request.horizonEndDate,
      focus: `Week ${index}`,
      workouts: [],
    })
    startDate = addDays(startDate, 7)
    index += 1
  }
  return { name: 'Target race block', focus: 'Prepare for the primary event', weeks }
}

function targetContext(upcomingRaces: UpcomingRace[]) {
  return buildCoachingContext({ ...contextInput(null), activities: [], upcomingRaces }, '2026-09-04')
}

function targetAdvisor(requests: BootstrapRequest[]): CoachingAdvisor {
  return {
    bootstrap: async (request) => {
      requests.push(request)
      return draftThrough(request)
    },
    evaluateActivity: async () => { throw new Error('not called') },
    reviewWeek: async () => { throw new Error('not called') },
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

  it('falls back to the near-term heuristic when Garmin has no primary event', async () => {
    const requests: BootstrapRequest[] = []
    const context = targetContext([
      { garminEventUuid: 'escher-5k', date: '2026-09-05', name: 'Escher Kulturlaf 5km', distance: '5K', isPrimaryEvent: false },
      { garminEventUuid: 'wine-route-10k', date: '2026-09-27', name: 'Wine Route - Luxemburg 10K', distance: '10K', isPrimaryEvent: false },
    ])
    const proposal = await createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
      now: () => new Date('2026-09-04T08:00:00Z'),
    })

    expect(requests[0]).toMatchObject({
      primaryTargetEvent: { id: 'wine-route-10k', role: 'primary' },
      tuneUpEvents: [{ id: 'escher-5k', role: 'tune_up' }],
      horizonEndDate: '2026-09-27',
    })
    expect(proposal.proposedPlan).toMatchObject({
      targetEvent: { id: 'wine-route-10k', role: 'primary' },
      tuneUpEvents: [{ id: 'escher-5k', role: 'tune_up' }],
      block: { endDate: '2026-09-27' },
      goal: { kind: 'time', targetSeconds: 2_400 },
    })
  })

  it('uses Garmin primary-event metadata even when the target is outside the rolling horizon', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await createBootstrapProposal(targetContext([
      { garminEventUuid: 'tune-up-5k', date: '2026-09-05', name: 'Tune-up 5K', distance: '5K', isPrimaryEvent: false },
      { garminEventUuid: 'primary-marathon', date: '2026-10-18', name: 'Primary Marathon', distance: 'Marathon', targetSeconds: 10_800, isPrimaryEvent: true },
    ]), [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]).toMatchObject({
      primaryTargetEvent: { id: 'primary-marathon', role: 'primary' },
      tuneUpEvents: [{ id: 'tune-up-5k', role: 'tune_up' }],
      horizonEndDate: '2026-10-01',
    })
    expect(proposal.proposedPlan).toMatchObject({
      targetEvent: { id: 'primary-marathon', date: '2026-10-18', role: 'primary' },
      block: { endDate: '2026-10-01' },
      goal: { kind: 'time', targetSeconds: 10_800 },
    })
  })

  it('stops at a sole race tomorrow', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await createBootstrapProposal(targetContext([
      { garminEventUuid: 'escher-5k', date: '2026-09-05', name: 'Escher Kulturlaf 5km', distance: '5K' },
    ]), [6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]?.horizonEndDate).toBe('2026-09-05')
    expect(proposal.proposedPlan).toMatchObject({
      targetEvent: { id: 'escher-5k', role: 'primary' },
      block: { endDate: '2026-09-05' },
      weeks: [{ startDate: '2026-09-04', endDate: '2026-09-05' }],
    })
    expect(proposal.proposedPlan?.tuneUpEvents).toBeUndefined()
  })

  it('stops at a single primary race three weeks away', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await createBootstrapProposal(targetContext([
      { garminEventUuid: 'autumn-10k', date: '2026-09-25', name: 'Autumn 10K', distance: '10K' },
    ]), [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]).toMatchObject({
      primaryTargetEvent: { id: 'autumn-10k', role: 'primary' },
      horizonEndDate: '2026-09-25',
    })
    expect(proposal.proposedPlan?.block.endDate).toBe('2026-09-25')
  })

  it('honors an explicit race override instead of Garmin primary metadata', async () => {
    const requests: BootstrapRequest[] = []
    const context = targetContext([
      { garminEventUuid: 'escher-5k', date: '2026-09-05', name: 'Escher Kulturlaf 5km', distance: '5K' },
      { garminEventUuid: 'wine-route-10k', date: '2026-09-27', name: 'Wine Route - Luxemburg 10K', distance: '10K', isPrimaryEvent: true },
    ])
    const proposal = await createBootstrapProposal(context, [6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    }, 'escher-5k')

    expect(requests[0]).toMatchObject({
      targetEventId: 'escher-5k',
      primaryTargetEvent: { id: 'escher-5k', role: 'primary' },
      tuneUpEvents: [],
      horizonEndDate: '2026-09-05',
    })
    expect(proposal.proposedPlan).toMatchObject({
      targetEvent: { id: 'escher-5k', role: 'primary' },
      block: { endDate: '2026-09-05' },
    })
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
