import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { AdvisorRecommendation, BootstrapRequest, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachDecision, CoachState, CoachingPlan, TrainingWeek, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { buildCoachingContext, coachingContextHash, type CoachingContextInput } from '../context'
import { applyCoachingProposal, createAutoregulationProposal, createBootstrapProposal, createPostActivityProposal, createWeeklyReviewProposal } from '../workflows'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { isoWeekWindows } from '@/domain/coaching/weekWindows'
import { GENERAL_PREPARATION } from '@/domain/coaching/macrocycle'
import { COACHING_SCHEMA_VERSION } from '@/domain/coaching/types'
import { parseCoachingPlan } from '@/domain/coaching/validation'

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
  archived: CoachingPlan[] = []
  archivePlan = (value: CoachingPlan) => { this.archived = [...this.archived, value] }
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
    trajectories: null,
    racePredictions: null,
    goals: [{ year: 2026, annualDistanceKm: 1_500, targets: [{ distance: '10K', targetSeconds: 2_400 }] }],
    personalBests: [],
    upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }],
    officialResults: [],
  }
}

function ids() {
  let value = 0
  return () => `generated-${++value}`
}

const NAMED = {
  threshold: { title: 'Threshold · 3 × 8′', shortName: 'Threshold 3×8′' },
  easy: { title: 'Easy run', shortName: 'Easy run' },
} as const

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
        ...NAMED[workout.type as keyof typeof NAMED],
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

function pushWorkout(
  draft: CoachingPlanDraft,
  ...workouts: CoachingPlanDraft['weeks'][number]['workouts']
): void {
  for (const workout of workouts) {
    const week = draft.weeks.find((candidate) => workout.date >= candidate.startDate && workout.date <= candidate.endDate)
    if (!week) throw new Error(`No draft week contains ${workout.date}`)
    week.workouts.push(workout)
  }
}

function draftThrough(request: BootstrapRequest): CoachingPlanDraft {
  const weeks = isoWeekWindows(request.planningStartDate, request.horizonEndDate).map((window, index) => ({
    ...window,
    focus: `Week ${index + 1}`,
    workouts: [],
  }))
  return { name: 'Target race block', focus: 'Prepare for the primary event', weeks }
}

function targetContext(upcomingRaces: UpcomingRace[]) {
  return buildCoachingContext({ ...contextInput(null), activities: [], upcomingRaces }, '2026-09-04')
}

function targetAdvisor(requests: BootstrapRequest[]): CoachingAdvisor {
  return {
    bootstrap: async (request) => {
      requests.push(request)
      const draft = draftThrough(request)
      for (const event of request.tuneUpEvents) {
        const week = draft.weeks.find((candidate) => candidate.startDate <= event.date && candidate.endDate >= event.date)
        if (!week) throw new Error(`No draft week contains ${event.date}`)
        week.workouts.push({
          date: event.date,
          type: 'race',
          title: event.name,
          shortName: 'Tune-up race',
          description: 'Run the structured supporting event.',
          blocks: [{ kind: 'effort', target: { distanceMeters: event.distanceMeters ?? 1_000 } }],
        })
      }
      return draft
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

  it('opens a new macrocycle when there is no journey toward the target yet', async () => {
    const repository = new MemoryRepository()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => fourWeekPlan(),
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')
    const proposal = await createBootstrapProposal(context, [2, 3], {
      repository, advisor, id: ids(), now: () => new Date('2026-09-07T08:00:00Z'),
    })
    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(result.macrocycleStartDate).toBe(result.block.startDate)
    expect(repository.getState()?.macrocycle).toEqual({
      targetEventId: result.targetEvent?.id,
      startDate: result.block.startDate,
    })
  })

  it('keeps the macrocycle start when the next rolling block bootstraps on the same target', async () => {
    const repository = new MemoryRepository()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => fourWeekPlan(),
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')
    const first = applyCoachingProposal(
      await createBootstrapProposal(context, [2, 3], { repository, advisor, id: ids(), now: () => new Date('2026-09-07T08:00:00Z') }),
      repository,
      coachingContextHash(context),
    )

    repository.plan = null
    const next = await createBootstrapProposal(context, [2, 3], {
      repository, advisor, id: ids(), now: () => new Date('2026-10-05T08:00:00Z'),
    })

    expect(next.proposedPlan?.macrocycleStartDate).toBe(first.macrocycleStartDate)
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

  it('uses UUID, numeric id, then date/name for coaching event identity', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await createBootstrapProposal(targetContext([
      { date: '2026-09-05', name: 'Fallback 5K', distance: '5K' },
      { garminEventId: 29837036, date: '2026-09-12', name: 'Private 5K', distance: '5K' },
      {
        garminEventUuid: 'primary-uuid',
        garminEventId: 400,
        date: '2026-09-27',
        name: 'Primary 10K',
        distance: '10K',
        isPrimaryEvent: true,
      },
    ]), [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]).toMatchObject({
      primaryTargetEvent: { id: 'primary-uuid' },
      tuneUpEvents: [
        { id: '2026-09-05:Fallback 5K' },
        { id: '29837036' },
      ],
    })
    expect(proposal.proposedPlan).toMatchObject({
      targetEvent: { id: 'primary-uuid' },
      tuneUpEvents: [
        { id: '2026-09-05:Fallback 5K' },
        { id: '29837036' },
      ],
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

  it('covers the 28 days after a completed same-day race as Monday-Sunday weeks, and enforces recovery', async () => {
    const requests: BootstrapRequest[] = []
    const completedRace = {
      ...latestActivity,
      id: 'completed-escher',
      date: '2026-09-05',
      type: 'Race',
      distanceKm: 5.02,
      durationSeconds: 1_198,
      paceSecPerKm: 239,
    } as Activity
    const context = buildCoachingContext({
      ...contextInput(null),
      activities: [completedRace],
      athlete: {
        thresholdPaceSecPerKm: 263,
        lthrBpm: 187,
        maxHrBpm: 202,
        hrZoneBoundsBpm: [125, 150, 168, 178, 188],
      },
      upcomingRaces: [
        {
          garminEventUuid: 'escher-5k',
          date: '2026-09-05',
          name: 'Escher Kulturlaf 5K',
          distance: '5K',
          targetSeconds: 1_200,
          isPrimaryEvent: false,
        },
        {
          garminEventId: 29837036,
          date: '2026-10-03',
          name: 'Broschtkriibslaf',
          distance: '5K',
          targetSeconds: 1_200,
          isPrimaryEvent: false,
          isTrainingEvent: true,
        },
        {
          garminEventUuid: 'november-primary-10k',
          date: '2026-11-29',
          name: '10K Wintzenheim',
          distance: '10K',
          targetSeconds: 2_400,
          isPrimaryEvent: true,
        },
      ],
    }, '2026-09-05')
    const availableWeekdays = [0, 2, 4, 6]
    const proposal = await createBootstrapProposal(context, availableWeekdays, {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
      now: () => new Date('2026-09-05T18:00:00Z'),
    })

    expect(requests[0]).toMatchObject({
      planningStartDate: '2026-09-06',
      horizonEndDate: '2026-10-03',
      primaryTargetEvent: {
        id: 'november-primary-10k',
        role: 'primary',
        targetSeconds: 2_400,
      },
      tuneUpEvents: [{
        id: '29837036',
        name: 'Broschtkriibslaf',
        date: '2026-10-03',
        role: 'tune_up',
        distanceLabel: '5K',
        distanceMeters: 5_000,
        targetSeconds: 1_200,
      }],
    })
    expect(requests[0]?.context.upcomingRaces.map((race) => race.name)).toEqual([
      'Broschtkriibslaf',
      '10K Wintzenheim',
    ])

    const plan = proposal.proposedPlan!
    expect(plan.block).toMatchObject({ startDate: '2026-09-06', endDate: '2026-10-03' })
    expect(plan.weeks).toHaveLength(5)
    expect(plan.weeks[0]).toMatchObject({ startDate: '2026-09-06', endDate: '2026-09-06' })
    expect(plan.weeks.slice(1).map((week) => week.startDate)).toEqual([
      '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    ])
    expect(plan.weeks.at(-1)).toMatchObject({ startDate: '2026-09-28', endDate: '2026-10-03' })
    expect(plan.targetEvent).toMatchObject({
      id: 'november-primary-10k', role: 'primary', targetSeconds: 2_400,
    })
    expect(plan.tuneUpEvents).toMatchObject([{
      id: '29837036', role: 'tune_up', targetSeconds: 1_200,
    }])
    const workouts = plan.weeks.flatMap((week) => week.workouts)
    expect(workouts).toContainEqual(expect.objectContaining({
      date: '2026-10-03', type: 'race', title: 'Broschtkriibslaf',
    }))
    expect(workouts.every((workout) => availableWeekdays.includes(new Date(`${workout.date}T00:00:00Z`).getUTCDay()))).toBe(true)
    expect(workouts.every((workout) => workout.date >= '2026-09-06' && workout.date <= '2026-10-03')).toBe(true)
    expect(proposal.decision).toMatchObject({
      effectiveDate: '2026-09-06',
      changes: [{ effectiveDate: '2026-09-06' }],
    })

    const baseAdvisor = targetAdvisor([])
    const aggressiveAdvisor: CoachingAdvisor = {
      ...baseAdvisor,
      bootstrap: async (request) => {
        const draft = await baseAdvisor.bootstrap(request)
        pushWorkout(draft, {
          date: '2026-09-08',
          type: 'threshold',
          title: '3x10 min threshold',
          description: 'Threshold repetitions too soon after the race.',
          blocks: [{
            kind: 'repeat',
            repetitions: 3,
            steps: [
              { kind: 'effort', target: { durationSeconds: 600 } },
              { kind: 'recovery', target: { durationSeconds: 120 } },
            ],
          }],
        })
        return draft
      },
    }
    await expect(createBootstrapProposal(context, availableWeekdays, {
      repository: new MemoryRepository(),
      advisor: aggressiveAdvisor,
      id: ids(),
      now: () => new Date('2026-09-05T18:00:00Z'),
    })).rejects.toThrow(/violates post-race recovery through 2026-09-08/)

    const conservativeBase = targetAdvisor([])
    const conservativeAdvisor: CoachingAdvisor = {
      ...conservativeBase,
      bootstrap: async (request) => {
        const draft = await conservativeBase.bootstrap(request)
        pushWorkout(
          draft,
          {
            date: '2026-09-06',
            type: 'recovery',
            title: 'Post-race recovery run',
            shortName: 'Recovery run',
            description: 'Very relaxed running after the race.',
            blocks: [{ kind: 'effort', target: { durationSeconds: 1_800, hrZone: 1 } }],
          },
          {
            date: '2026-09-08',
            type: 'easy',
            title: 'Easy aerobic run',
            shortName: 'Easy run',
            description: 'Keep the final recovery day easy.',
            blocks: [{ kind: 'effort', target: { durationSeconds: 2_100, hrZone: 2 } }],
          },
          {
            date: '2026-09-10',
            type: 'threshold',
            title: 'Threshold · 3 × 8′',
            shortName: 'Threshold 3×8′',
            description: 'Resume quality after the protected recovery window.',
            blocks: [{
              kind: 'repeat',
              repetitions: 3,
              steps: [
                { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 260, max: 270 } } },
                { kind: 'recovery', target: { durationSeconds: 120 } },
              ],
            }],
          },
        )
        return draft
      },
    }
    await expect(createBootstrapProposal(context, availableWeekdays, {
      repository: new MemoryRepository(),
      advisor: conservativeAdvisor,
      id: ids(),
      now: () => new Date('2026-09-05T18:00:00Z'),
    })).resolves.toBeDefined()
  })

  it('can still bootstrap for an uncompleted race later on the reference date', async () => {
    const requests: BootstrapRequest[] = []
    const morningRun = {
      ...latestActivity,
      id: 'morning-shakeout',
      date: '2026-09-05',
      type: 'Base',
      distanceKm: 3,
    } as Activity
    const context = buildCoachingContext({
      ...contextInput(null),
      activities: [morningRun],
      upcomingRaces: [
        { garminEventUuid: 'later-today-5k', date: '2026-09-05', name: 'Later Today 5K', distance: '5K' },
        { garminEventUuid: 'primary-10k', date: '2026-11-29', name: 'Primary 10K', distance: '10K', isPrimaryEvent: true },
      ],
    }, '2026-09-05')
    const proposal = await createBootstrapProposal(context, [6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]).toMatchObject({
      planningStartDate: '2026-09-05',
      horizonEndDate: '2026-10-02',
      tuneUpEvents: [{ id: 'later-today-5k', date: '2026-09-05', role: 'tune_up' }],
    })
    expect(proposal.proposedPlan).toMatchObject({
      block: { startDate: '2026-09-05', endDate: '2026-10-02' },
      tuneUpEvents: [{ id: 'later-today-5k' }],
    })
  })

  it('rejects a normal hard session within two days of a supporting race', async () => {
    const requests: BootstrapRequest[] = []
    const context = targetContext([
      { garminEventId: 29837036, date: '2026-09-27', name: 'Supporting 5K', distance: '5K' },
      { garminEventUuid: 'primary-10k', date: '2026-11-29', name: 'Primary 10K', distance: '10K', isPrimaryEvent: true },
    ])
    const baseAdvisor = targetAdvisor(requests)
    const advisor: CoachingAdvisor = {
      ...baseAdvisor,
      bootstrap: async (request) => {
        const draft = await baseAdvisor.bootstrap(request)
        const week = draft.weeks.find((candidate) => candidate.startDate <= '2026-09-25' && candidate.endDate >= '2026-09-25')!
        week.workouts.push({
          date: '2026-09-25',
          type: 'threshold',
          title: 'Normal 4x4min threshold session',
          description: 'A full threshold workout.',
          blocks: [{
            kind: 'repeat',
            repetitions: 4,
            steps: [
              { kind: 'effort', target: { durationSeconds: 240 } },
              { kind: 'recovery', target: { durationSeconds: 120 } },
            ],
          }],
        })
        return draft
      },
    }

    await expect(createBootstrapProposal(context, [0, 2, 4, 5, 6], {
      repository: new MemoryRepository(),
      advisor,
      id: ids(),
    })).rejects.toThrow(/too close to the Supporting 5K tune-up race/)
  })

  it('keeps primary and tune-up race goals scoped to their own events', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await createBootstrapProposal(targetContext([
      { garminEventUuid: 'escher-5k', date: '2026-09-05', name: 'Escher Kulturlaf 5km', distance: '5K', targetSeconds: 1_200, isPrimaryEvent: false },
      { garminEventUuid: 'wine-route-10k', date: '2026-09-27', name: 'Wine Route - Luxemburg', distance: '10K', isPrimaryEvent: false },
      { garminEventUuid: 'november-10k', date: '2026-11-29', name: '10 km', distance: '10K', targetSeconds: 2_400, isPrimaryEvent: true },
    ]), [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    })

    expect(requests[0]?.primaryTargetEvent).toMatchObject({
      id: 'november-10k', role: 'primary', targetSeconds: 2_400,
    })
    expect(requests[0]?.tuneUpEvents).toHaveLength(2)
    expect(requests[0]?.tuneUpEvents[0]).toMatchObject({
      id: 'escher-5k', role: 'tune_up', targetSeconds: 1_200,
    })
    expect(requests[0]?.tuneUpEvents[1]).toMatchObject({
      id: 'wine-route-10k', role: 'tune_up',
    })
    expect(requests[0]?.tuneUpEvents[1]).not.toHaveProperty('targetSeconds')
    expect(proposal.proposedPlan?.tuneUpEvents?.[0]?.targetSeconds).toBe(1_200)
    expect(proposal.proposedPlan?.tuneUpEvents?.[1]).not.toHaveProperty('targetSeconds')
  })

  it('rejects an invented finish-time goal for a tune-up without an explicit goal', async () => {
    const context = targetContext([
      { garminEventUuid: 'wine-route-10k', date: '2026-09-27', name: 'Wine Route - Luxemburg', distance: '10K', isPrimaryEvent: false },
      { garminEventUuid: 'november-10k', date: '2026-11-29', name: '10 km', distance: '10K', targetSeconds: 2_400, isPrimaryEvent: true },
    ])
    const advisor = (description: string): CoachingAdvisor => ({
      bootstrap: async (request) => {
        const draft = draftThrough(request)
        draft.weeks[3]!.workouts.push({
          date: '2026-09-27',
          type: 'race',
          title: '10K Tune-up race',
          shortName: 'Tune-up race',
          description,
          blocks: [{ kind: 'effort', target: { distanceMeters: 10_000, paceSecPerKm: { min: 245, max: 255 } } }],
        })
        return draft
      },
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    })

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Target goal is 40:00.'), id: ids(),
    })).rejects.toThrow(/has no explicit time goal/)

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Recommended pacing strategy: 4:05/km to 4:15/km.'), id: ids(),
    })).resolves.toBeDefined()

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(),
      advisor: {
        ...advisor('Recommended pacing strategy: 4:05/km.'),
        bootstrap: async (request) => {
          const draft = draftThrough(request)
          draft.weeks[3]!.focus = 'Wine Route 40:00 target'
          return draft
        },
      },
      id: ids(),
    })).rejects.toThrow(/must not narrate numeric race targets/)
  })

  it('rejects finish-time prose that contradicts a tune-up explicit goal', async () => {
    const context = targetContext([
      { garminEventUuid: 'escher-5k', date: '2026-09-05', name: 'Escher Kulturlaf 5km', distance: '5K', targetSeconds: 1_200, isPrimaryEvent: false },
      { garminEventUuid: 'november-10k', date: '2026-11-29', name: '10 km', distance: '10K', targetSeconds: 2_400, isPrimaryEvent: true },
    ])
    const advisor = (description: string, paceSecPerKm = 249): CoachingAdvisor => ({
      bootstrap: async (request) => {
        const draft = draftThrough(request)
        draft.weeks[0]!.workouts.push({
          date: '2026-09-05',
          type: 'race',
          title: '5K tune-up',
          shortName: '5K tune-up',
          description,
          blocks: [{ kind: 'effort', target: { distanceMeters: 5_000, paceSecPerKm: { min: paceSecPerKm, max: paceSecPerKm } } }],
        })
        return draft
      },
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    })

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Run 249 sec/km for a 24:55 finish.'), id: ids(),
    })).rejects.toThrow(/contradicts its explicit 20:00 goal/)

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Target pace is 4:09/km for a 20:00 finish.'), id: ids(),
    })).rejects.toThrow(/contradicts its deterministic target pace/)

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Target goal is 20:00.'), id: ids(),
    })).rejects.toThrow(/finish-time prose contradicts its structured race pace/)

    await expect(createBootstrapProposal(context, [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: advisor('Target goal is 20:00 at 4:00/km.', 240), id: ids(),
    })).resolves.toBeDefined()
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

  it('accepts a numeric Garmin event id as an explicit race override', async () => {
    const requests: BootstrapRequest[] = []
    const context = targetContext([
      { garminEventId: 29837036, date: '2026-09-05', name: 'Private 5K', distance: '5K' },
      { garminEventUuid: 'primary-10k', date: '2026-09-27', name: 'Primary 10K', distance: '10K', isPrimaryEvent: true },
    ])
    const proposal = await createBootstrapProposal(context, [6], {
      repository: new MemoryRepository(),
      advisor: targetAdvisor(requests),
      id: ids(),
    }, '29837036')

    expect(requests[0]).toMatchObject({
      targetEventId: '29837036',
      primaryTargetEvent: { id: '29837036', name: 'Private 5K' },
      horizonEndDate: '2026-09-05',
    })
    expect(proposal.proposedPlan?.targetEvent?.id).toBe('29837036')
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
    const changed = { ...repository.plan.weeks[1]!.workouts[0]!, title: 'Easy run shortened', shortName: 'Easy run', totalDurationSeconds: 2_400 }
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({
        outcome: 'ADJUST', reasonCodes: ['FATIGUE'], summary: 'Reduce the next easy run.', evidence: [],
        changes: [{ kind: 'upsert_workout', workoutId: changed.id, workout: changed }],
      }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')
    // Pinned clock: on the real one the 2026-09-15 workout is past, and past prescriptions are immutable.
    const proposal = await createPostActivityProposal(context, latestActivity, {
      repository, advisor, id: ids(), now: () => new Date('2026-09-09T08:00:00Z'),
    })

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

  it('never lets a model-supplied id rewrite a prescription outside the future it replaces', async () => {
    // Replanning from Thursday, the model reuses the id of Wednesday's session - already run - for a new one on Saturday.
    const repository = new MemoryRepository()
    repository.plan = plan()
    const [thisWeek, nextWeek] = repository.plan.weeks
    const past = thisWeek!.workouts[0]!
    const collision = { ...past, date: '2026-09-12', title: 'Threshold, moved to Saturday', shortName: 'Threshold' }
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => ({
        outcome: 'REPLAN', reasonCodes: ['MISSED_SESSION'], summary: 'Move the threshold session.', evidence: [],
        changes: [{ kind: 'replace_future', effectiveDate: '2026-09-10', weeks: [{ ...thisWeek!, workouts: [collision] }, nextWeek!] }],
      }),
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-10')

    const proposal = await createWeeklyReviewProposal(context, { repository, advisor, id: ids() })
    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))
    const workouts = result.weeks.flatMap((week) => week.workouts)

    expect(workouts.find((workout) => workout.id === past.id)).toEqual(past)
    expect(workouts.find((workout) => workout.date === '2026-09-12')).toMatchObject({
      id: expect.stringMatching(/^generated-/),
      revision: 1,
      status: 'prescribed',
    })
  })

  it('keeps the macrocycle anchored across a weekly-review replan', async () => {
    const repository = new MemoryRepository()
    repository.plan = { ...plan(), macrocycleStartDate: '2026-08-03' }
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

    expect(result.macrocycleStartDate).toBe('2026-08-03')
    expect(repository.state?.macrocycle).toEqual({ targetEventId: result.targetEvent?.id, startDate: '2026-08-03' })
  })

  it('records the macrocycle for a plan written before the field existed', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const advisor: CoachingAdvisor = {
      bootstrap: async () => { throw new Error('not called') },
      evaluateActivity: async () => ({ outcome: 'KEEP', reasonCodes: ['SESSION_COMPLETED'], summary: 'As intended.', evidence: [], changes: [] }),
      reviewWeek: async () => { throw new Error('not called') },
    }
    const context = buildCoachingContext(contextInput(repository.plan), '2026-09-09')
    const proposal = await createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids() })
    applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(repository.state?.macrocycle).toEqual({ targetEventId: 'race-1', startDate: plan().block.startDate })
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

describe('holding a change to the rules a new block answers to', () => {
  // Tuesdays and Wednesdays; the easy run on Tuesday the 15th is still ahead.
  const preferred = () => plan({ trainingPreferences: { availableWeekdays: [2, 3], runsPerWeek: 2 } })
  const now = () => new Date('2026-09-09T08:00:00Z')

  function adjusting(changes: AdvisorRecommendation['changes'], outcome: AdvisorRecommendation['outcome'] = 'ADJUST') {
    const repository = new MemoryRepository()
    repository.plan = preferred()
    const advice = async (): Promise<AdvisorRecommendation> => ({ outcome, reasonCodes: ['FATIGUE'], summary: 'Ease off.', evidence: [], changes })
    const advisor: CoachingAdvisor = { bootstrap: async () => { throw new Error('not called') }, evaluateActivity: advice, reviewWeek: advice }
    return { repository, advisor, context: buildCoachingContext(contextInput(repository.plan), '2026-09-09') }
  }

  it('refuses an adjustment that moves a run off the athlete\'s weekdays', async () => {
    const easy = preferred().weeks[1]!.workouts[0]!
    const { repository, advisor, context } = adjusting([{ kind: 'upsert_workout', workoutId: easy.id, workout: { ...easy, date: '2026-09-19' } }])

    await expect(createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids(), now }))
      .rejects.toThrow(/2026-09-19 is outside the available weekdays/)
  })

  it('refuses a replan whose sessions are written wrong', async () => {
    const week = preferred().weeks[1]!
    const bare = { ...week.workouts[0]!, blocks: [{ kind: 'strides' as const, target: { durationSeconds: 20 } }] }
    const { repository, advisor, context } = adjusting(
      [{ kind: 'replace_future', effectiveDate: '2026-09-09', weeks: [{ ...week, workouts: [bare] }] }],
      'REPLAN',
    )

    await expect(createWeeklyReviewProposal(context, { repository, advisor, id: ids(), now }))
      .rejects.toThrow(/standalone strides are not supported/)
  })

  it('refuses an adjustment naming a prescription the plan does not have', async () => {
    const easy = preferred().weeks[1]!.workouts[0]!
    const { repository, advisor, context } = adjusting([{ kind: 'upsert_workout', workoutId: 'invented-id', workout: easy }])

    await expect(createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids(), now }))
      .rejects.toThrow(/Prescription not found: invented-id/)
  })

  it('gives a new session an id of its own, whatever id the model wrote on it', async () => {
    // A new Wednesday session carrying the id of Tuesday's run. Were that id
    // trusted, Tuesday's prescription would quietly become Wednesday's.
    const easy = preferred().weeks[1]!.workouts[0]!
    const added = { ...easy, date: '2026-09-16', title: 'Added easy run', shortName: 'Easy run', blocks: [{ kind: 'effort' as const, target: { distanceMeters: 3_000 } }] }
    const { repository, advisor, context } = adjusting([{ kind: 'upsert_workout', workout: added }])

    const proposal = await createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids(), now })
    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(result.weeks[1]!.workouts).toEqual([
      easy,
      expect.objectContaining({ id: expect.stringMatching(/^generated-/), date: '2026-09-16', revision: 1, status: 'prescribed' }),
    ])
  })

  it('still lets an adjustment cancel a run', async () => {
    const easy = preferred().weeks[1]!.workouts[0]!
    const { repository, advisor, context } = adjusting([{ kind: 'cancel_workout', workoutId: easy.id }])

    const proposal = await createPostActivityProposal(context, latestActivity, { repository, advisor, id: ids(), now })
    const result = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(result.weeks[1]!.workouts[0]).toMatchObject({ id: easy.id, status: 'cancelled' })
  })
})

it('passes and persists five-run preference independently of availability through bootstrap and apply', async () => {
  const repository = new MemoryRepository()
  const context = buildCoachingContext(contextInput(null), '2026-09-07')
  const advisor: CoachingAdvisor = {
    ...targetAdvisor([]),
    bootstrap: async request => {
      expect(request.runsPerWeek).toBe(5)
      expect(request.guidance).toBe('Preserve accepted workouts')
      expect(request.availableWeekdays).toEqual([0, 2, 3, 4, 6])
      expect(request.context.trainingHistory).toBeDefined()
      const draft = draftThrough(request)
      for (const week of draft.weeks) {
        for (let offset = 0; offset < 7; offset++) {
          const date = addDays(week.startDate, offset)
          if (!request.availableWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue
          week.workouts.push({ date, type: 'easy', title: 'Easy run', shortName: 'Easy run', description: 'Comfortable aerobic effort', blocks: [{ kind: 'effort', target: { distanceMeters: 5000 } }] })
        }
      }
      return draft
    },
  }
  const proposal = await createBootstrapProposal(context, [0, 2, 3, 4, 6], { repository, advisor, id: ids() }, undefined, 5, 'Preserve accepted workouts')
  expect(proposal.proposedPlan?.weeks.map(w => w.workouts.length)).toEqual([5, 5, 5, 5])
  applyCoachingProposal(proposal, repository, coachingContextHash(context))
  expect(repository.plan?.trainingPreferences).toEqual({ availableWeekdays: [0, 2, 3, 4, 6], runsPerWeek: 5 })
})

describe('replacing a plan that is already active', () => {
  const services = (repository: MemoryRepository) => ({
    repository,
    advisor: { bootstrap: async () => fourWeekPlan(), evaluateActivity: async () => { throw new Error('not called') }, reviewWeek: async () => { throw new Error('not called') } },
    id: ids(),
    now: () => new Date('2026-09-07T08:00:00Z'),
  })

  it('refuses by default, and says how to proceed', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    await expect(createBootstrapProposal(context, [2, 3], services(repository)))
      .rejects.toThrow(/--replace/)
  })

  it('supersedes the active plan when asked, and writes nothing until applied', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const outgoing = repository.plan.id
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    const proposal = await createBootstrapProposal(context, [2, 3], services(repository), undefined, undefined, undefined, true)

    expect(proposal.proposedPlan?.id).not.toBe(outgoing)
    expect(repository.plan?.id).toBe(outgoing)
    expect(repository.archived).toEqual([])
  })

  it('applies over the plan it was built against, archiving it on the way past', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const outgoing = repository.plan.id
    const context = buildCoachingContext(contextInput(null), '2026-09-07')
    const proposal = await createBootstrapProposal(context, [2, 3], services(repository), undefined, undefined, undefined, true)

    const applied = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    expect(applied.id).toBe(proposal.proposedPlan?.id)
    expect(repository.plan?.id).toBe(applied.id)
    expect(repository.archived.map((item) => item.id)).toEqual([outgoing])
  })

  it('refuses when the plan it was built against has since moved', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const context = buildCoachingContext(contextInput(null), '2026-09-07')
    const proposal = await createBootstrapProposal(context, [2, 3], services(repository), undefined, undefined, undefined, true)

    repository.plan = { ...repository.plan!, revision: repository.plan!.revision + 1 }

    expect(() => applyCoachingProposal(proposal, repository, coachingContextHash(context)))
      .toThrow(/current plan revision changed/)
  })
})

describe('repairing a rejected draft', () => {
  const services = (bootstrap: CoachingAdvisor['bootstrap']) => ({
    repository: new MemoryRepository(),
    advisor: {
      bootstrap,
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    } satisfies CoachingAdvisor,
    id: ids(),
    now: () => new Date('2026-09-07T08:00:00Z'),
  })

  // 2026-09-21 is a Monday, and only Tuesday and Wednesday are available.
  const onAnUnavailableDay = () => {
    const draft = fourWeekPlan()
    draft.weeks[2]!.workouts[0]!.date = '2026-09-21'
    return draft
  }

  it('asks again with the complaint when our own rules reject the draft', async () => {
    const asks: (string | undefined)[] = []
    const bootstrap = async (request: BootstrapRequest) => {
      asks.push(request.guidance)
      return asks.length === 1 ? onAnUnavailableDay() : fourWeekPlan()
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    const proposal = await createBootstrapProposal(context, [2, 3], services(bootstrap))

    expect(proposal.proposedPlan?.revision).toBe(1)
    expect(asks).toHaveLength(2)
    expect(asks[1]).toContain('rejected')
    expect(asks[1]).toContain('outside the available weekdays')
  })

  it('asks again when one session is written wrong, as it does for any other rule', async () => {
    const asks: (string | undefined)[] = []
    const withBareStrides = () => {
      const draft = fourWeekPlan()
      draft.weeks[1]!.workouts[0]!.blocks = [{ kind: 'strides', target: { durationSeconds: 20 } }]
      return draft
    }
    const bootstrap = async (request: BootstrapRequest) => {
      asks.push(request.guidance)
      return asks.length === 1 ? withBareStrides() : fourWeekPlan()
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    const proposal = await createBootstrapProposal(context, [2, 3], services(bootstrap))

    expect(proposal.proposedPlan?.revision).toBe(1)
    expect(asks).toHaveLength(2)
    expect(asks[1]).toContain('standalone strides are not supported')
  })

  it('keeps the caller guidance alongside the complaint', async () => {
    const asks: (string | undefined)[] = []
    const bootstrap = async (request: BootstrapRequest) => {
      asks.push(request.guidance)
      return asks.length === 1 ? onAnUnavailableDay() : fourWeekPlan()
    }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    await createBootstrapProposal(context, [2, 3], services(bootstrap), undefined, undefined, 'Build toward 55 km.')

    expect(asks[0]).toBe('Build toward 55 km.')
    expect(asks[1]).toContain('Build toward 55 km.')
  })

  it('gives up rather than asking forever, and reports the rule that rejected it', async () => {
    let asked = 0
    const bootstrap = async () => { asked++; return onAnUnavailableDay() }
    const context = buildCoachingContext(contextInput(null), '2026-09-07')

    await expect(createBootstrapProposal(context, [2, 3], services(bootstrap)))
      .rejects.toThrow(/outside the available weekdays/)
    expect(asked).toBe(3)
  })
})

describe('general preparation', () => {
  const general = (context: ReturnType<typeof targetContext>, requests: BootstrapRequest[], repository = new MemoryRepository()) =>
    createBootstrapProposal(context, [0, 2, 3, 4, 6], {
      repository, advisor: targetAdvisor(requests), id: ids(), now: () => new Date('2026-09-04T08:00:00Z'),
    }, undefined, undefined, undefined, true, true)

  it('plans four full weeks toward no race when none is registered', async () => {
    const requests: BootstrapRequest[] = []
    const repository = new MemoryRepository()
    const context = targetContext([])
    const proposal = await createBootstrapProposal(context, [0, 2, 3, 4, 6], {
      repository, advisor: targetAdvisor(requests), id: ids(), now: () => new Date('2026-09-04T08:00:00Z'),
    })

    expect(requests[0]).toMatchObject({ primaryTargetEvent: null, tuneUpEvents: [], horizonEndDate: '2026-10-01' })
    expect(proposal.proposedPlan?.targetEvent).toBeUndefined()
    expect(proposal.proposedPlan?.goal.kind).toBe('performance')
    expect(proposal.decision.summary).toMatch(/general preparation/)

    applyCoachingProposal(proposal, repository, coachingContextHash(context))
    expect(repository.getState()?.macrocycle).toEqual({ targetEventId: GENERAL_PREPARATION, startDate: '2026-09-04' })
  })

  it('runs every race inside the block as a supporting one, whichever Garmin marks primary', async () => {
    const requests: BootstrapRequest[] = []
    const proposal = await general(targetContext([
      { garminEventUuid: 'autumn-10k', date: '2026-09-27', name: 'Autumn 10K', distance: '10K', isPrimaryEvent: true },
      { garminEventUuid: 'spring-half', date: '2027-05-08', name: 'Spring Half', distance: 'Half-Marathon' },
    ]), requests)

    expect(requests[0]).toMatchObject({
      primaryTargetEvent: null,
      tuneUpEvents: [{ id: 'autumn-10k', role: 'tune_up' }],
      horizonEndDate: '2026-10-01',
    })
    expect(proposal.proposedPlan).toMatchObject({ tuneUpEvents: [{ id: 'autumn-10k' }], block: { endDate: '2026-10-01' } })
    expect(proposal.proposedPlan?.targetEvent).toBeUndefined()
  })

  it('refuses a block that is asked to be general and to target a race at once', async () => {
    await expect(createBootstrapProposal(targetContext([
      { garminEventUuid: 'autumn-10k', date: '2026-09-27', name: 'Autumn 10K', distance: '10K' },
    ]), [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: targetAdvisor([]), id: ids(),
    }, 'autumn-10k', undefined, undefined, false, true)).rejects.toThrow(/no target race/)
  })

  it('keeps counting from where general preparation began when the next block is written', async () => {
    const repository = new MemoryRepository()
    repository.saveState({
      schemaVersion: COACHING_SCHEMA_VERSION,
      activePlanId: null,
      activePlanRevision: null,
      lastDecisionId: null,
      lastBootstrapAt: null,
      lastPostActivityAt: null,
      lastWeeklyReviewAt: null,
      macrocycle: { targetEventId: GENERAL_PREPARATION, startDate: '2026-08-07' },
      updatedAt: '2026-09-01T00:00:00Z',
    })
    const requests: BootstrapRequest[] = []
    const proposal = await general(targetContext([]), requests, repository)

    expect(requests[0]?.macrocycleStartDate).toBe('2026-08-07')
    expect(proposal.proposedPlan?.macrocycleStartDate).toBe('2026-08-07')
  })
})

describe('provenance', () => {
  it('records the advisor that wrote the block, not Gemini by default', async () => {
    const requests: BootstrapRequest[] = []
    const advisor = { ...targetAdvisor(requests), source: 'manual' as const }
    const proposal = await createBootstrapProposal(targetContext([]), [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor, id: ids(), now: () => new Date('2026-09-04T08:00:00Z'),
    })

    expect(proposal.proposedPlan?.provenance.source).toBe('manual')
    expect(proposal.decision.provenance.source).toBe('manual')
  })

  it('still reads an advisor that does not say as Gemini', async () => {
    const proposal = await createBootstrapProposal(targetContext([]), [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: targetAdvisor([]), id: ids(), now: () => new Date('2026-09-04T08:00:00Z'),
    })

    expect(proposal.proposedPlan?.provenance.source).toBe('gemini')
  })

  it('records the hash of the guidance the block was written from, and none without guidance', async () => {
    const bootstrap = (guidance?: string) => createBootstrapProposal(targetContext([]), [0, 2, 4, 6], {
      repository: new MemoryRepository(), advisor: targetAdvisor([]), id: ids(), now: () => new Date('2026-09-04T08:00:00Z'),
    }, undefined, undefined, guidance)

    const guided = await bootstrap('Run/walk by time; stop on any pain.')
    const again = await bootstrap('Run/walk by time; stop on any pain.')
    const unguided = await bootstrap()

    expect(guided.decision.provenance.guidanceHash).toMatch(/^[0-9a-f]{24}$/)
    expect(again.decision.provenance.guidanceHash).toBe(guided.decision.provenance.guidanceHash)
    expect(unguided.decision.provenance).not.toHaveProperty('guidanceHash')
  })
})

describe('a block that starts on a later Monday', () => {
  const withStart = (repository: MemoryRepository, requests: BootstrapRequest[], start: string) => {
    const context = buildCoachingContext({ ...contextInput(repository.plan), activities: [], upcomingRaces: [] }, '2026-09-08')
    const proposal = createBootstrapProposal(context, [0, 2, 3, 4, 6], {
      repository, advisor: targetAdvisor(requests), id: ids(), now: () => new Date('2026-09-08T08:00:00Z'),
    }, undefined, undefined, undefined, true, true, start)
    return { context, proposal }
  }

  it('keeps the current plan\'s sessions until then exactly as written, and writes the block from that Monday', async () => {
    const repository = new MemoryRepository()
    repository.plan = plan()
    const kept = repository.plan.weeks[0]!.workouts[0]!
    const requests: BootstrapRequest[] = []
    const { context, proposal } = withStart(repository, requests, '2026-09-14')
    const result = await proposal

    expect(requests[0]).toMatchObject({ planningStartDate: '2026-09-14', horizonEndDate: '2026-10-11' })
    expect(result.proposedPlan?.block).toMatchObject({ startDate: '2026-09-08', endDate: '2026-10-11' })
    const [first, second] = result.proposedPlan!.weeks
    expect(first).toMatchObject({ index: 1, startDate: '2026-09-08', endDate: '2026-09-13' })
    // Its title predates the naming rules; kept, it is not judged by them again.
    expect(first!.workouts).toEqual([kept])
    expect(second).toMatchObject({ index: 2, startDate: '2026-09-14' })
    // A session of the outgoing plan on or after the start is replaced, not kept.
    const written = result.proposedPlan!.weeks.flatMap((week) => week.workouts.map((workout) => workout.id))
    expect(written).not.toContain('workout-easy')

    const applied = applyCoachingProposal(result, repository, coachingContextHash(context))
    expect(applied.weeks[0]!.workouts).toEqual([kept])
  })

  it('refuses a start that is not a Monday within the coming week', async () => {
    for (const start of ['2026-09-15', '2026-09-21', '2026-09-07']) {
      const repository = new MemoryRepository()
      repository.plan = plan()
      await expect(withStart(repository, [], start).proposal).rejects.toThrow(/--start must be a Monday/)
    }
  })
})

describe('an autoregulation proposal', () => {
  const EASY = { min: 330, max: 384 }
  const LONG = { min: 272, max: 280 }
  const MEDIUM = { min: 268, max: 274 }
  const label = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  const prescription = (id: string, date: string, fields: Partial<WorkoutPrescription>): WorkoutPrescription => ({
    id, revision: 1, date, type: 'easy', title: 'Easy run', shortName: 'Easy run', description: 'Easy.', status: 'prescribed',
    blocks: [{ kind: 'effort', target: { distanceMeters: 9_000, paceSecPerKm: EASY } }],
    provenance: { source: 'manual', trigger: 'bootstrap', createdAt: '2026-10-15T17:00:00.000Z' }, ...fields,
  })
  const controlled = (id: string, date: string, reps: number, minutes: number, guide: { min: number; max: number }) => {
    const pace = label(Math.round((guide.min + guide.max) / 2))
    return prescription(id, date, {
      type: 'threshold', title: `Threshold · ${reps} × ${minutes}′ @ ${pace}`, shortName: `Threshold ${reps}×${minutes}′`,
      structure: { reps, repMinutes: minutes, targetPace: pace },
      blocks: [
        { kind: 'warmup', target: { distanceMeters: 3_700, paceSecPerKm: EASY } },
        { kind: 'repeat', repetitions: reps, steps: [
          { kind: 'effort', target: { durationSeconds: minutes * 60, paceSecPerKm: guide, hrBpm: { min: 156, max: 173 } } },
          { kind: 'recovery', target: { durationSeconds: 90, paceSecPerKm: { min: 360, max: 420 } } },
        ] },
        { kind: 'cooldown', target: { distanceMeters: 1_700, paceSecPerKm: EASY } },
      ],
    })
  }
  const stridesRun = (id: string, date: string) => prescription(id, date, {
    title: 'Easy · 8 km + 6 strides', shortName: 'Easy + strides', structure: { extras: ['6 strides'] },
    blocks: [
      { kind: 'effort', target: { distanceMeters: 8_000, paceSecPerKm: EASY } },
      { kind: 'repeat', repetitions: 6, steps: [
        { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 215, max: 230 } } },
        { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 360, max: 420 } } },
      ] },
    ],
  })
  const fullWeek = (n: number, start: string): TrainingWeek => {
    const day = (offset: number) => addDays(start, offset)
    return {
      id: `week-${n}`, index: n, startDate: start, endDate: day(6), focus: 'The repeatable week.',
      workouts: [
        prescription(`easy-${n}`, day(1), {}),
        controlled(`long-${n}`, day(2), 3, 10, LONG),
        stridesRun(`strides-${n}`, day(3)),
        controlled(`medium-${n}`, day(5), 5, 6, MEDIUM),
        prescription(`longrun-${n}`, day(6), { type: 'long_run', title: 'Long run', shortName: 'Long run', blocks: [{ kind: 'effort', target: { distanceMeters: 14_000, paceSecPerKm: EASY } }] }),
      ],
    }
  }
  const block = (): CoachingPlan => plan({
    id: 'threshold-block',
    trainingPreferences: { availableWeekdays: [0, 2, 3, 4, 6], runsPerWeek: 5 },
    block: { id: 'threshold-block:block', name: 'Controlled threshold base', startDate: '2026-11-02', endDate: '2026-11-15', focus: 'Repeat the week.' },
    targetEvent: undefined,
    goal: { kind: 'performance', description: 'Progress.' },
    weeks: [fullWeek(1, '2026-11-02'), fullWeek(2, '2026-11-09')],
  })

  // Eight weeks of about 55 km on five days: enough history that the volume
  // ceiling judges these weeks as the athlete's, not a beginner's.
  const history = (): Activity[] => Array.from({ length: 56 }, (_, offset) => addDays('2026-09-07', offset))
    .filter((date) => [0, 2, 3, 4, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()))
    .map((date) => {
      const long = new Date(`${date}T00:00:00Z`).getUTCDay() === 0
      return { ...latestActivity, id: `h-${date}`, date, type: 'Base', distanceKm: long ? 14 : 10, durationSeconds: long ? 4_830 : 3_450, paceSecPerKm: 345, avgHeartRate: 145 } as Activity
    })

  const setup = () => {
    const repository = new MemoryRepository()
    // As the repository reads it: parsed, so a change's "before" compares like for like.
    repository.plan = parseCoachingPlan(block())
    const context = buildCoachingContext({ ...contextInput(repository.plan), activities: history(), upcomingRaces: [] }, '2026-11-04')
    return { repository, context, services: { repository, advisor: targetAdvisor([]), id: ids(), now: () => new Date('2026-11-04T20:00:00Z') } }
  }

  it('moves only the coming sessions on that guide, and applies as any other proposal', () => {
    const { repository, context, services } = setup()
    const proposal = createAutoregulationProposal(context, services, {
      kind: 'pace_guide',
      proposal: { repClass: 'long', direction: 'faster', guide: LONG, proposedGuide: { min: 268, max: 276 }, stepSecPerKm: 4, sessions: [] },
    })!

    expect(proposal.kind).toBe('autoregulation')
    expect(proposal.decision).toMatchObject({ outcome: 'ADJUST', trigger: 'autoregulation', provenance: { source: 'autoregulation' } })
    // Today's session is run; only next week's is rewritten, faster than the block began, and allowed.
    expect(proposal.decision.changes.map((change) => change.kind === 'upsert_workout' ? change.after.id : null)).toEqual(['long-2'])

    const applied = applyCoachingProposal(proposal, repository, coachingContextHash(context))
    const moved = applied.weeks[1]!.workouts.find((workout) => workout.id === 'long-2')!
    expect(moved).toMatchObject({ title: 'Threshold · 3 × 10′ @ 4:32', revision: 2, status: 'adjusted' })
    expect(applied.weeks[0]!.workouts.find((workout) => workout.id === 'long-1')!.title).toBe('Threshold · 3 × 10′ @ 4:36')
  })

  it('writes the lighter week into the rest of the flagged run\'s week', () => {
    const { context, services } = setup()
    const proposal = createAutoregulationProposal(context, services, {
      kind: 'lighter_week',
      fatigue: { run: { activityId: 'h', date: '2026-11-04', hr: 152, paceSecPerKm: 345, gapSecPerKm: null, climbMPerKm: 2, tempC: 12, durationSeconds: 3_300 }, normalHr: 146, comparables: 4, gradeAdjusted: 0, leftOut: [], flagged: true },
    })!

    const after = Object.fromEntries(proposal.decision.changes.map((change) => change.kind === 'upsert_workout' ? [change.after.id, change.after.title] : []))
    expect(after).toEqual({
      'strides-1': 'Easy · 6.5 km + 6 strides',
      'medium-1': 'Threshold · 3 × 6′ @ 4:31',
      'longrun-1': 'Long run',
    })
  })

  it('proposes nothing for a run that was not flagged', () => {
    const { context, services } = setup()
    expect(createAutoregulationProposal(context, services, {
      kind: 'lighter_week',
      fatigue: { run: { activityId: 'h', date: '2026-11-04', hr: 147, paceSecPerKm: 345, gapSecPerKm: null, climbMPerKm: 2, tempC: 12, durationSeconds: 3_300 }, normalHr: 146, comparables: 4, gradeAdjusted: 0, leftOut: [], flagged: false },
    })).toBeNull()
  })
})
