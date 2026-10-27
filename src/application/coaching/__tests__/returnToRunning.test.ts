import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { AthleteProfile, TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { contextPrompt } from '@/infrastructure/ai/coachingPrompt'
import { buildCoachingContext } from '../context'
import { validateBootstrapDraft } from '../draftRules'
import { returnToRunning } from '../returnToRunning'
import { toGarminWorkoutPayload } from '../garminWorkoutMapping'
import type { WorkoutPrescription, WorkoutTarget } from '@/domain/coaching/types'
import block from '../../../../fixtures/garmin/forerunner-55/walk-run-block.json'

const walkRuns = block.runs as unknown as Activity[]
const injury: TrainingBreak = { start: '2025-10-06', end: '2026-04-14', reason: 'injury' }

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

const PACE: WorkoutTarget = { paceSecPerKm: { min: 480, max: 600 } }
const ZONE_2: WorkoutTarget = { hrBpm: { min: 124, max: 144 } }

function walkRun(date: string, reps: number, minutes: number, run = PACE, walk: WorkoutTarget = {}): BootstrapWorkoutDraft {
  return {
    date,
    type: 'easy',
    title: `Easy · ${reps} × ${minutes}′`,
    shortName: `Easy ${reps}×${minutes}′`,
    structure: { reps, repMinutes: minutes },
    description: 'Stop and see the physio on any pain at the injured site.',
    blocks: [
      { kind: 'warmup', target: { durationSeconds: 300 } },
      {
        kind: 'repeat',
        repetitions: reps,
        steps: [
          { kind: 'effort', target: { durationSeconds: minutes * 60, ...run } },
          { kind: 'recovery', target: { durationSeconds: 60, ...walk } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 300 } },
    ],
  }
}

const returnBlock = (run = PACE, walk: WorkoutTarget = {}): CoachingPlanDraft => ({
  name: 'Gentle return',
  focus: 'Run/walk by time, lengthening the running a step at a time.',
  weeks: [
    { startDate: '2026-04-27', endDate: '2026-05-03', focus: 'Four-minute runs.', workouts: [walkRun('2026-04-29', 5, 4, run, walk), walkRun('2026-05-01', 5, 4, run, walk), walkRun('2026-05-03', 4, 6, run, walk)] },
    { startDate: '2026-05-04', endDate: '2026-05-10', focus: 'Six-minute runs.', workouts: [walkRun('2026-05-06', 4, 6, run, walk), walkRun('2026-05-08', 4, 6, run, walk), walkRun('2026-05-10', 3, 8, run, walk)] },
    { startDate: '2026-05-11', endDate: '2026-05-17', focus: 'Eight-minute runs.', workouts: [walkRun('2026-05-13', 3, 8, run, walk), walkRun('2026-05-15', 3, 8, run, walk), walkRun('2026-05-17', 2, 12, run, walk)] },
    { startDate: '2026-05-18', endDate: '2026-05-24', focus: 'Ten-minute runs.', workouts: [walkRun('2026-05-20', 3, 10, run, walk), walkRun('2026-05-22', 3, 10, run, walk), walkRun('2026-05-24', 2, 12, run, walk)] },
  ],
})

const walksNoted = (draft: CoachingPlanDraft): CoachingPlanDraft => ({
  ...draft,
  weeks: draft.weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => ({
      ...workout,
      blocks: workout.blocks.map((block) => block.kind === 'repeat'
        ? { ...block, steps: block.steps.map((step) => (step.kind === 'recovery' ? { ...step, notes: ['Walk.'] } : step)) }
        : { ...block, notes: ['Brisk walk.'] }),
    })),
  })),
})

const validate = (athlete: AthleteProfile, draft = returnBlock(), guidance?: string) => () => validateBootstrapDraft(draft, {
  availableWeekdays: [3, 5, 0],
  runsPerWeek: 3,
  context: context(athlete),
  events: { primary: null, tuneUps: [], planningStartDate: '2026-04-27' },
  ...(guidance ? { guidance } : {}),
})

describe('a return to running', () => {
  it('holds after a long injury, illness or pregnancy break while every run since still walks', () => {
    expect(returnToRunning([{ ...injury, reason: 'illness' }], [], '2026-04-27')).not.toBeNull()
    expect(returnToRunning([{ ...injury, reason: 'pregnancy' }], [], '2026-04-27')).not.toBeNull()
    expect(returnToRunning([injury], walkRuns, '2026-04-27')).toEqual({
      reason: 'injury', breakStart: '2025-10-06', breakEnd: '2026-04-14', longestContinuousMinutesSince: 4,
    })
  })

  it('ends with a run of 30 minutes without a walk, and never starts after a short stop or a travel break', () => {
    expect(returnToRunning([injury], [...walkRuns, continuousRun('2026-04-25', 30)], '2026-04-27')).toBeNull()
    expect(returnToRunning([injury], [...walkRuns, continuousRun('2026-04-25', 25)], '2026-04-27')).not.toBeNull()
    expect(returnToRunning([{ start: '2026-03-30', end: '2026-04-14', reason: 'illness' }], walkRuns, '2026-04-27')).toBeNull()
    expect(returnToRunning([{ ...injury, reason: 'travel' }], walkRuns, '2026-04-27')).toBeNull()
  })

  it('takes the rebuild toward the best four-week average out of the prompt', () => {
    const returning = contextPrompt(context({ trainingBreaks: [injury] }))
    const resuming = contextPrompt(context({}))

    expect(returning).not.toContain('rebuild toward best4WeekAverageKm')
    expect(returning).toContain('the return-to-running rules set where volume starts')
    expect(resuming).toContain('rebuild toward best4WeekAverageKm')
  })

  it('accepts a run/walk block for an athlete with no LTHR, whom no controlled threshold rule reaches', () => {
    const athlete = context({ trainingBreaks: [injury] })

    expect(athlete.controlledThreshold).toBeNull()
    expect(athlete).not.toHaveProperty('autoregulation')
    expect(validate({ trainingBreaks: [injury] })).not.toThrow()
    expect(validate({}, walksNoted(returnBlock()))).toThrow(/against a recent/)
  })

  it('counts an untargeted step as run outside a return, unless its notes say it is walked', () => {
    expect(validate({})).not.toThrow(/against a recent/)
    expect(validate({}, walksNoted(returnBlock()))).toThrow(/against a recent/)
  })

  const watchTargets = (draft: CoachingPlanDraft) => {
    const payload = toGarminWorkoutPayload(draft.weeks[0]!.workouts[0] as unknown as WorkoutPrescription) as unknown as {
      workoutSegments: { workoutSteps: { workoutSteps?: { targetType: { workoutTargetTypeKey: string } }[] }[] }[]
    }
    return payload.workoutSegments[0]!.workoutSteps.flatMap((step) => step.workoutSteps ?? []).map((step) => step.targetType.workoutTargetTypeKey)
  }

  it('runs to the heart-rate zone the guidance gives, and walks with no target', () => {
    const zoned = returnBlock(ZONE_2)

    expect(validate({ trainingBreaks: [injury] }, zoned)).not.toThrow()
    expect(watchTargets(zoned)).toEqual(['heart.rate.zone', 'no.target'])
  })

  it('runs to an easy pace with no zone in the guidance, and refuses a walk with a target or a run with both', () => {
    expect(validate({ trainingBreaks: [injury] })).not.toThrow()
    expect(watchTargets(returnBlock())).toEqual(['pace.zone', 'no.target'])
    expect(validate({ trainingBreaks: [injury] }, returnBlock(PACE, PACE))).toThrow(/walk break in a return carries no pace/)
    expect(validate({ trainingBreaks: [injury] }, returnBlock({ ...PACE, ...ZONE_2 }))).toThrow(/heart-rate zone or its pace range, not both/)
  })

  it('keeps notes off the steps and the workout, so the watch shows one line', () => {
    const noted = (change: (workout: BootstrapWorkoutDraft) => BootstrapWorkoutDraft): CoachingPlanDraft => {
      const draft = returnBlock()
      return { ...draft, weeks: draft.weeks.map((week) => ({ ...week, workouts: week.workouts.map(change) })) }
    }

    expect(validate({ trainingBreaks: [injury] }, noted((workout) => ({ ...workout, notes: ['Talk in full sentences.'] })))).toThrow(/one-line description/)
    expect(validate({ trainingBreaks: [injury] }, noted((workout) => ({ ...workout, blocks: [{ kind: 'warmup', target: { durationSeconds: 300 }, notes: ['Brisk walk.'] }, ...workout.blocks.slice(1)] })))).toThrow(/step in a return carries no notes/)
  })

  it('accepts the stop rule by default, and refuses one anywhere when the guidance asks for no stop signals', () => {
    const noStopSignals = 'Write no stop signals or symptom warnings in sessions, descriptions or focus.'
    const described = (description: string, focus = 'Four-minute runs.'): CoachingPlanDraft => {
      const draft = returnBlock()
      return { ...draft, weeks: draft.weeks.map((week, index) => ({ ...week, ...(index === 0 ? { focus } : {}), workouts: week.workouts.map((workout) => ({ ...workout, description })) })) }
    }

    expect(validate({ trainingBreaks: [injury] })).not.toThrow()
    expect(validate({ trainingBreaks: [injury] }, returnBlock(), noStopSignals)).toThrow(/asks for no stop signals/)
    expect(validate({ trainingBreaks: [injury] }, described('Course continue, marche si besoin.'), noStopSignals)).not.toThrow()
    expect(validate({ trainingBreaks: [injury] }, described('Arrête si fuite, pesanteur ou douleur.'), noStopSignals)).toThrow(/workouts\[0\]: the guidance asks/)
    expect(validate({ trainingBreaks: [injury] }, described('Easy, walk when you need to.', 'Stop on any leaking.'), noStopSignals)).toThrow(/weeks\[0\]\.focus/)
  })
})
