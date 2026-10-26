import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { AthleteProfile, TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { contextPrompt } from '@/infrastructure/ai/coachingPrompt'
import { buildCoachingContext } from '../context'
import { validateBootstrapDraft } from '../draftRules'
import { returnToRunning } from '../returnToRunning'
import block from '../../../../fixtures/garmin/forerunner-55/walk-run-block.json'

const walkRuns = block.runs as unknown as Activity[]
const pregnancy: TrainingBreak = { start: '2025-10-06', end: '2026-04-14', reason: 'pregnancy' }

function continuousRun(date: string, minutes: number): Activity {
  const lap = { type: 'lap' as const, durationSec: 300, distanceM: 750, avgSpeedMs: 2.5, avgHr: 150, laps: [] }
  return { ...walkRuns[0]!, id: `continuous-${date}`, date, startTimeLocal: `${date}T10:00:00`, splits: Array(minutes / 5).fill(lap) }
}

function context(athlete: AthleteProfile) {
  return buildCoachingContext({
    activities: walkRuns,
    plan: null,
    athlete,
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
  }, '2026-04-27')
}

function walkRun(date: string, reps: number, minutes: number): BootstrapWorkoutDraft {
  return {
    date,
    type: 'easy',
    title: `Easy · ${reps} × ${minutes}′`,
    shortName: `Easy ${reps}×${minutes}′`,
    structure: { reps, repMinutes: minutes },
    description: 'Run and walk by time, at a pace that leaves breath to talk.',
    blocks: [
      { kind: 'warmup', target: { durationSeconds: 300 } },
      {
        kind: 'repeat',
        repetitions: reps,
        steps: [
          { kind: 'effort', target: { durationSeconds: minutes * 60, paceSecPerKm: { min: 480, max: 600 } } },
          { kind: 'recovery', target: { durationSeconds: 60 } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 300 } },
    ],
    notes: ['Stop and see the midwife on any leaking, heaviness or pelvic pain.'],
  }
}

const returnBlock: CoachingPlanDraft = {
  name: 'Gentle return',
  focus: 'Run/walk by time, lengthening the running a step at a time.',
  weeks: [
    { startDate: '2026-04-27', endDate: '2026-05-03', focus: 'Four-minute runs.', workouts: [walkRun('2026-04-29', 5, 4), walkRun('2026-05-01', 5, 4), walkRun('2026-05-03', 4, 6)] },
    { startDate: '2026-05-04', endDate: '2026-05-10', focus: 'Six-minute runs.', workouts: [walkRun('2026-05-06', 4, 6), walkRun('2026-05-08', 4, 6), walkRun('2026-05-10', 3, 8)] },
    { startDate: '2026-05-11', endDate: '2026-05-17', focus: 'Eight-minute runs.', workouts: [walkRun('2026-05-13', 3, 8), walkRun('2026-05-15', 3, 8), walkRun('2026-05-17', 2, 12)] },
    { startDate: '2026-05-18', endDate: '2026-05-24', focus: 'Ten-minute runs.', workouts: [walkRun('2026-05-20', 3, 10), walkRun('2026-05-22', 3, 10), walkRun('2026-05-24', 2, 12)] },
  ],
}

const validate = (athlete: AthleteProfile) => () => validateBootstrapDraft(structuredClone(returnBlock), {
  availableWeekdays: [3, 5, 0],
  runsPerWeek: 3,
  context: context(athlete),
  events: { primary: null, tuneUps: [], planningStartDate: '2026-04-27' },
})

describe('a return to running', () => {
  it('holds after a long pregnancy break while every run since still walks', () => {
    expect(returnToRunning([pregnancy], walkRuns, '2026-04-27')).toEqual({
      reason: 'pregnancy', breakStart: '2025-10-06', breakEnd: '2026-04-14', longestContinuousMinutesSince: 4,
    })
  })

  it('ends with a run of 30 minutes without a walk, and never starts after a short stop or a travel break', () => {
    expect(returnToRunning([pregnancy], [...walkRuns, continuousRun('2026-04-25', 30)], '2026-04-27')).toBeNull()
    expect(returnToRunning([pregnancy], [...walkRuns, continuousRun('2026-04-25', 25)], '2026-04-27')).not.toBeNull()
    expect(returnToRunning([{ start: '2026-03-30', end: '2026-04-14', reason: 'illness' }], walkRuns, '2026-04-27')).toBeNull()
    expect(returnToRunning([{ ...pregnancy, reason: 'travel' }], walkRuns, '2026-04-27')).toBeNull()
  })

  it('takes the rebuild toward the best four-week average out of the prompt', () => {
    const returning = contextPrompt(context({ trainingBreaks: [pregnancy] }))
    const resuming = contextPrompt(context({}))

    expect(returning).not.toContain('rebuild toward best4WeekAverageKm')
    expect(returning).toContain('the return-to-running rules set where volume starts')
    expect(resuming).toContain('rebuild toward best4WeekAverageKm')
  })

  it('accepts a run/walk block for an athlete with no LTHR, whom no controlled threshold rule reaches', () => {
    const athlete = context({ trainingBreaks: [pregnancy] })

    expect(athlete.controlledThreshold).toBeNull()
    expect(athlete).not.toHaveProperty('autoregulation')
    expect(validate({ trainingBreaks: [pregnancy] })).not.toThrow()
    expect(validate({})).toThrow(/against a recent/)
  })
})
