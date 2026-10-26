import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingAdvisor } from '@/application/ports/CoachingAdvisor'
import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { sessionForRun, sessionsAcrossPlans } from '@/domain/coaching/sessionForRun'
import { buildCoachingContext } from '../context'
import { createPostActivityProposal } from '../workflows'
import { buildCoachingOverview } from '../GetCoachingView'
import block from '../../../../fixtures/garmin/forerunner-55/walk-run-block.json'

const runs = block.runs as unknown as Activity[]

const walkRunPlan: CoachingPlan = plan({
  weeks: [
    { id: 'w1', index: 1, startDate: '2026-10-12', endDate: '2026-10-18', focus: 'Return', workouts: [] },
    { id: 'w2', index: 2, startDate: '2026-10-19', endDate: '2026-10-25', focus: 'Return', workouts: [] },
  ].map((week) => ({
    ...week,
    workouts: block.sessions
      .filter((session) => session.date >= week.startDate && session.date <= week.endDate)
      .map((session) => workout({ ...session, type: session.type as WorkoutPrescription['type'] })),
  })),
})

function context(referenceDate: string) {
  return buildCoachingContext({
    activities: runs,
    plan: walkRunPlan,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: null,
    trajectories: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
    officialResults: [],
  }, referenceDate)
}

describe('a walk/run block the watch filed as VO2Max', () => {
  it('counts every run as its session in the coach context', () => {
    const coach = context('2026-10-26')

    expect(coach.adherence).toEqual({ prescribed: 5, completed: 5, percent: 100 })
    expect(coach.recentActivities.map((run) => [run.type, run.intendedType])).toEqual(Array(5).fill(['VO2Max', 'Base']))
  })

  it('evaluates the run against its session', async () => {
    const repository = { getCurrentPlan: () => walkRunPlan } as never
    const advisor = {
      evaluateActivity: async () => ({ outcome: 'KEEP', reasonCodes: ['SESSION_COMPLETED'], summary: 'Done.', evidence: [], changes: [] }),
    } as unknown as CoachingAdvisor
    const proposal = await createPostActivityProposal(context('2026-10-25'), runs.at(-1)!, { repository, advisor, now: () => new Date('2026-10-25T12:00:00Z') })

    expect(proposal.evaluation).toMatchObject({ prescriptionId: 'session-5', matchStatus: 'matched' })
  })

  it('shows every session done on Plan and names each run after its session', () => {
    const overview = buildCoachingOverview(walkRunPlan, [] as WorkoutEvaluation[], runs, '2026-10-26')

    expect(overview.workouts.map((view) => [view.state, view.activityId])).toEqual(runs.map((run) => ['completed', run.id]))
    expect(runs.map((run) => sessionForRun(run, sessionsAcrossPlans([walkRunPlan], []))?.id)).toEqual(block.sessions.map((s) => s.id))
  })
})
