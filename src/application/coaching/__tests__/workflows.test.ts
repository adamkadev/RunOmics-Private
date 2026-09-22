import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { BootstrapRequest, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachDecision, CoachState, CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { buildCoachingContext, coachingContextHash, type CoachingContextInput } from '../context'
import { applyCoachingProposal, createBootstrapProposal, createPostActivityProposal, createWeeklyReviewProposal } from '../workflows'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { isoWeekWindows } from '@/domain/coaching/weekWindows'

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
    officialResults: [],
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
      targetEventId: result.targetEvent.id,
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
            description: 'Very relaxed running after the race.',
            blocks: [{ kind: 'effort', target: { durationSeconds: 1_800, hrZone: 1 } }],
          },
          {
            date: '2026-09-08',
            type: 'easy',
            title: 'Easy aerobic run',
            description: 'Keep the final recovery day easy.',
            blocks: [{ kind: 'effort', target: { durationSeconds: 2_100, hrZone: 2 } }],
          },
          {
            date: '2026-09-10',
            type: 'threshold',
            title: 'Controlled threshold intervals',
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
    expect(proposal.proposedPlan?.targetEvent.id).toBe('29837036')
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
    // Pin the clock like every other case in this file: the workout being adjusted
    // is dated 2026-09-15, so on the real clock this test started throwing
    // "past prescriptions are immutable" the day the calendar passed it.
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
    expect(repository.state?.macrocycle).toEqual({ targetEventId: result.targetEvent.id, startDate: '2026-08-03' })
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
          week.workouts.push({ date, type: 'easy', title: 'Easy run', description: 'Comfortable aerobic effort', blocks: [{ kind: 'effort', target: { distanceMeters: 5000 } }] })
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
