import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { CoachingAdvisor } from '@/application/ports/CoachingAdvisor'
import { MODEL_POOL } from '@/domain/ai/budget'
import { buildCoachingContext } from '@/application/coaching/context'
import { createBootstrapProposal } from '@/application/coaching/workflows'
import {
  BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
  GeminiCoachingAdvisor,
  bootstrapEventPrompt,
  completedActivityPrompt,
  pacing,
} from '../GeminiCoachingAdvisor'
import { parseBootstrapPlanDraft } from '../coachingAnswer'
import { WORKOUT_NAMING_INSTRUCTION } from '../coachingRules.generated'

const gemini = vi.hoisted(() => ({ generateStructuredJson: vi.fn() }))
vi.mock('@/lib/gemini', () => gemini)

const COACH_KEY = 'coach-key'

beforeEach(() => {
  vi.stubEnv('GEMINI_COACH_API_KEY', COACH_KEY)
  // Real pacing waits 13 seconds between calls; tests assert what is sent, not when.
  pacing.lastRequestAt = 0
  pacing.sleep = () => Promise.resolve()
})

afterEach(() => {
  vi.unstubAllEnvs()
  pacing.now = () => Date.now()
})

const repository: CoachingRepository = {
  getCurrentPlan: () => null,
  saveCurrentPlan: () => {},
  getState: () => null,
  saveState: () => {},
  getDecisions: () => [],
  getDecision: () => null,
  saveDecision: () => {},
  getEvaluations: () => [],
  getEvaluationForActivity: () => null,
  saveEvaluation: () => {},
}

function rawBootstrap(includePlaceholderIds: boolean) {
  const iso = (offset: number) => new Date(Date.UTC(2026, 8, 7 + offset)).toISOString().slice(0, 10)
  return {
    name: 'Four-week 10K block',
    focus: 'Aerobic durability',
    weeks: Array.from({ length: 4 }, (_, weekIndex) => {
      const weekOffset = weekIndex * 7
      const date = iso(weekOffset + 1)
      return {
        ...(includePlaceholderIds ? { id: 'draft-week' } : {}),
        startDate: iso(weekOffset),
        endDate: iso(weekOffset + 6),
        focus: `Week ${weekIndex + 1}`,
        workouts: [0, 1].map((workoutIndex) => ({
          ...(includePlaceholderIds ? { id: 'draft-workout' } : {}),
          date,
          type: workoutIndex === 0 ? 'easy' : 'tempo',
          title: workoutIndex === 0 ? 'Easy run' : 'Tempo run',
          shortName: workoutIndex === 0 ? 'Easy run' : 'Tempo run',
          description: 'A structurally valid session.',
          totalDistanceMeters: 999_999,
          blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
        })),
      }
    }),
  }
}

function context() {
  return buildCoachingContext({
    activities: [],
    plan: null,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null, trajectories: null,
    latestVo2max: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }],
    officialResults: [],
  }, '2026-09-07')
}

describe('Gemini bootstrap draft boundary', () => {
  it('does not ask Gemini for persistent week or workout IDs or calculated totals', () => {
    const week = BOOTSTRAP_PLAN_RESPONSE_SCHEMA.properties.weeks.items
    const workout = week.properties.workouts.items

    expect(week.properties).not.toHaveProperty('id')
    expect(workout.properties).not.toHaveProperty('id')
    expect(workout.properties).not.toHaveProperty('totalDurationSeconds')
    expect(workout.properties).not.toHaveProperty('totalDistanceMeters')
    expect(workout.properties.blocks.items.properties.kind.enum).not.toContain('strides')
    expect(workout.properties.blocks.items.properties.steps.items.properties.kind.enum).toContain('strides')
  })

  it.each([
    ['repeated placeholder IDs', true],
    ['absent IDs', false],
  ])('materializes unique persistent workout IDs when draft IDs are %s', async (_label, includePlaceholderIds) => {
    const draft = parseBootstrapPlanDraft(rawBootstrap(includePlaceholderIds))
    const advisor: CoachingAdvisor = {
      bootstrap: async () => draft,
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    }
    let nextId = 0
    const proposal = await createBootstrapProposal(context(), [2], {
      advisor,
      repository,
      id: () => `persistent-${++nextId}`,
      now: () => new Date('2026-09-07T08:00:00.000Z'),
    })
    const workouts = proposal.proposedPlan!.weeks.flatMap((week) => week.workouts)

    expect(draft.weeks.flatMap((week) => week.workouts).every((workout) => !('id' in workout))).toBe(true)
    expect(new Set(workouts.map((workout) => workout.id)).size).toBe(workouts.length)
    expect(workouts.map((workout) => workout.id)).toEqual([
      'persistent-1:workout:1:1', 'persistent-1:workout:1:2',
      'persistent-1:workout:2:1', 'persistent-1:workout:2:2',
      'persistent-1:workout:3:1', 'persistent-1:workout:3:2',
      'persistent-1:workout:4:1', 'persistent-1:workout:4:2',
    ])
    expect(workouts.every((workout) => workout.revision === 1)).toBe(true)
    expect(workouts.every((workout) => workout.totalDistanceMeters === 5_000)).toBe(true)
  })

  it('exposes independent explicit-goal facts for each prompt event', () => {
    expect(bootstrapEventPrompt({
      id: 'primary', name: 'Primary 10K', date: '2026-11-29', role: 'primary',
      distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
    })).toMatchObject({
      role: 'primary', hasExplicitGoal: true, targetSeconds: 2_400,
      targetFinishTime: '40:00', targetPaceSecPerKm: 240, targetPace: '4:00/km',
    })
    const tuneUpPrompt = bootstrapEventPrompt({
      id: 'tune-up', name: 'Tune-up 10K', date: '2026-09-27', role: 'tune_up',
      distanceLabel: '10K', distanceMeters: 10_000,
    })
    expect(tuneUpPrompt).toMatchObject({ role: 'tune_up', hasExplicitGoal: false })
    expect(tuneUpPrompt).not.toHaveProperty('targetSeconds')
    expect(tuneUpPrompt).not.toHaveProperty('targetFinishTime')
    expect(tuneUpPrompt).not.toHaveProperty('targetPaceSecPerKm')
  })

  it('labels primary and tune-up goals independently in the Gemini request', async () => {
    gemini.generateStructuredJson.mockResolvedValueOnce({ ok: true, value: rawBootstrap(false) })
    const coachingContext = context()
    coachingContext.athlete.lthrBpm = 187
    coachingContext.athlete.hrZoneBoundsBpm = [125, 150, 168, 178, 188]
    coachingContext.recentActivities = [{
      id: 'completed-race',
      date: '2026-09-06',
      type: 'Race',
      distanceKm: 5,
      durationSeconds: 1_200,
      paceSecPerKm: 240,
      avgHeartRate: 190,
      rpe: 10,
      aerobicTrainingEffect: 4.5,
      anaerobicTrainingEffect: 2.5,
      execution: null,
    }]
    coachingContext.volume.runs28Days = 4
    coachingContext.gaps.longestGap28Days = 8
    coachingContext.load.garminAcuteLoad = 650
    coachingContext.load.garminChronicLoad = 300
    coachingContext.load.garminLoadStatus = 'HIGH'
    await new GeminiCoachingAdvisor().bootstrap({
      context: coachingContext,
      availableWeekdays: [0, 2, 3, 4, 6],
      runsPerWeek: 5,
      guidance: 'Preserve the accepted sessions; add only easy aerobic volume.',
      planningStartDate: '2026-09-07',
      primaryTargetEvent: {
        id: 'primary', name: 'Primary 10K', date: '2026-10-18', role: 'primary',
        distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
      },
      tuneUpEvents: [{
        id: 'tune-up', name: 'Tune-up 10K', date: '2026-09-27', role: 'tune_up',
        distanceLabel: '10K', distanceMeters: 10_000,
      }],
      horizonEndDate: '2026-10-04',
      macrocycleStartDate: '2026-09-01',
    })

    const request = gemini.generateStructuredJson.mock.calls.at(-1)?.[0] as {
      apiKey: string
      systemInstruction: string
      prompt: string
    }
    expect(request.apiKey).toBe(COACH_KEY)
    expect(request.systemInstruction).toContain('Never copy a primary goal to a tune-up')
    expect(request.systemInstruction).toContain('Include every tune-up inside the planning period as a race workout')
    expect(request.systemInstruction).toContain('Treat supplied hrZoneBoundsBpm as authoritative Garmin zone boundaries')
    expect(request.systemInstruction).toContain('every prescribed session through recoveryThroughDate must be easy or recovery only')
    expect(request.systemInstruction).toContain('Hill repetitions must use effort/RPE or form guidance')
    expect(request.systemInstruction).toContain('Do not assign hrZone or hrBpm to strides')
    expect(request.prompt).toContain('not a mandatory next-week mileage')
    expect(request.prompt).toContain('"trainingHistory":')
    expect(request.prompt).toContain('runsPerWeek (normal desired frequency): 5')
    expect(request.systemInstruction).toContain('never a frequency setting')
    expect(request.systemInstruction).toContain('preference, never a mandatory quota')
    expect(request.systemInstruction).toContain('must not automatically turn its whole week into a cutback')
    expect(request.systemInstruction).toContain('never another quality workout or a faster long-run finish')
    expect(request.prompt).toContain('Preserve the accepted sessions; add only easy aerobic volume.')
    expect(request.systemInstruction).toContain('4–5 x 800m or equivalent 3-minute repetitions')
    expect(request.systemInstruction).toContain('Wednesday rest')
    expect(request.systemInstruction).toContain('entirely easy with no progression or faster finish')
    expect(request.prompt).not.toContain('paceSamples')
    expect(request.prompt).toContain('PRIMARY_TARGET:')
    expect(request.prompt).toContain('POST_RACE_RECOVERY:')
    expect(request.prompt).toContain('"required":true')
    expect(request.prompt).toContain('"completedRaceDate":"2026-09-06"')
    expect(request.prompt).toContain('"recoveryThroughDate":"2026-09-09"')
    expect(request.prompt).toContain('"recentRuns28Days":4')
    expect(request.prompt).toContain('"garminAcuteLoad":650')
    expect(request.prompt).toContain('Plan starts: 2026-09-07')
    expect(request.prompt).toContain('"lthrBpm":187')
    expect(request.prompt).toContain('"hrZoneBoundsBpm":[125,150,168,178,188]')
    expect(request.prompt).toContain('"role":"primary"')
    expect(request.prompt).toContain('"targetSeconds":2400')
    expect(request.prompt).toContain('"targetFinishTime":"40:00"')
    expect(request.prompt).toContain('TUNE_UP_EVENTS (each goal is independent):')
    expect(request.prompt).toContain('"role":"tune_up"')
    expect(request.prompt).toContain('"hasExplicitGoal":false')
    const tuneUpLine = request.prompt.split('\n').find((line) => line.startsWith('TUNE_UP_EVENTS'))!
    const tuneUpEvents = JSON.parse(tuneUpLine.slice(tuneUpLine.indexOf(':') + 1)) as Array<Record<string, unknown>>
    expect(tuneUpEvents).toHaveLength(1)
    expect(tuneUpEvents[0]).toMatchObject({ id: 'tune-up', role: 'tune_up', hasExplicitGoal: false })
    expect(tuneUpEvents[0]).not.toHaveProperty('targetSeconds')
  })

  it('tells a general block it has no target to peak for, and how far into preparation it is', async () => {
    gemini.generateStructuredJson.mockResolvedValueOnce({ ok: true, value: rawBootstrap(false) })
    await new GeminiCoachingAdvisor().bootstrap({
      context: context(),
      availableWeekdays: [0, 2, 3, 4, 6],
      runsPerWeek: 5,
      planningStartDate: '2026-09-07',
      primaryTargetEvent: null,
      tuneUpEvents: [],
      horizonEndDate: '2026-10-04',
      macrocycleStartDate: '2026-08-24',
    })

    const { prompt } = gemini.generateStructuredJson.mock.calls.at(-1)?.[0] as { prompt: string }
    expect(prompt).toContain('PRIMARY_TARGET: none - general preparation')
    expect(prompt).toContain('"mode":"general_preparation"')
    expect(prompt).toContain('"startDate":"2026-09-07","endDate":"2026-09-13","phase":"general","weekOfPreparation":3')
    expect(prompt).not.toContain('raceDate')
  })

  it('keeps strides as the repeat group the model prescribed', () => {
    const raw = rawBootstrap(false)
    const firstWorkout = raw.weeks[0]!.workouts[0]! as { title: string; blocks: unknown[] }
    firstWorkout.title = 'Easy Run with Strides'
    firstWorkout.blocks = [
      { kind: 'effort', target: { distanceMeters: 5_000 } },
      {
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20 } },
          { kind: 'recovery', target: { durationSeconds: 60 } },
        ],
      },
    ]

    expect(parseBootstrapPlanDraft(raw).weeks[0]!.workouts[0]!.blocks[1]).toMatchObject({
      kind: 'repeat',
      repetitions: 6,
      steps: [
        { kind: 'strides', target: { durationSeconds: 20 } },
        { kind: 'recovery', target: { durationSeconds: 60 } },
      ],
    })
  })

  it('reads a session it would be wrong to run, and leaves the judging to the draft rules', () => {
    // Rejected here, a rule broken by one session skipped the repair loop that
    // every other rule gets; see draftRules.ts.
    const raw = rawBootstrap(false)
    const workout = raw.weeks[0]!.workouts[0]! as { title: string; blocks: unknown[] }
    workout.title = 'Hill intervals'
    workout.blocks = [{ kind: 'effort', target: { durationSeconds: 60, paceSecPerKm: { min: 220, max: 230 } } }]

    expect(() => parseBootstrapPlanDraft(raw)).not.toThrow()
  })
})

it('labels course-aware target pace as an average without changing flat-race facts', () => {
  const event = { id: 'course', name: 'Hilly race', date: '2026-10-03', distanceMeters: 5000, targetSeconds: 1200 }
  expect(bootstrapEventPrompt(event)).not.toHaveProperty('pacingMode')
  expect(bootstrapEventPrompt({ ...event, courseContext: { pacingNotes: ['Follow supplied PacePro.'] } })).toMatchObject({ targetSeconds: 1200, targetPaceSecPerKm: 240, pacingMode: 'course_aware', goalPaceMeaning: 'average_over_entire_course_not_constant_pace' })
})

describe('completed activity prompt', () => {
  const lap = (durationSec: number, distanceM: number, avgHr: number) => ({
    type: 'lap' as const,
    durationSec,
    distanceM,
    avgSpeedMs: distanceM / durationSec,
    avgHr,
    laps: [],
  })

  const escher = {
    id: 'escher',
    date: '2026-09-05',
    type: 'Race',
    distanceKm: 5.25,
    durationSeconds: 1_310,
    paceSecPerKm: 249.5,
    avgHeartRate: 196,
    rpe: 10,
    aerTrainingEffect: 5,
    anaTrainingEffect: 3.1,
    splits: [lap(236, 1_000, 191), lap(245, 1_000, 196), lap(249, 1_000, 199), lap(253, 1_000, 197), lap(255, 1_000, 198), lap(71, 248.6, 197)],
  } as unknown as Activity

  const officialResult = {
    activityId: 'escher',
    eventName: 'Escher Kulturlaf',
    date: '2026-09-05',
    distanceMeters: 5_000,
    chipTimeSeconds: 1_292,
    gunTimeSeconds: 1_293,
    overallPlace: 28,
  }

  const raceContext = (officialResults: typeof officialResult[]) =>
    buildCoachingContext({
      activities: [escher],
      plan: null,
      athlete: {},
      trainingStatus: null,
      loadBalance: null,
      trainingZones: null, trajectories: null,
      latestVo2max: null,
      racePredictions: null,
      goals: [],
      personalBests: [],
      upcomingRaces: [],
      officialResults,
    }, '2026-09-05')

  it('hands Gemini the official performance rather than the GPS reading', () => {
    const prompt = completedActivityPrompt(raceContext([officialResult]), escher)

    expect(prompt.performance).toMatchObject({ source: 'official', distanceKm: 5, durationSeconds: 1_292, paceSecPerKm: 258.4, overallPlace: 28 })
    expect(prompt).not.toHaveProperty('distanceKm')
    expect(prompt).not.toHaveProperty('paceSecPerKm')
  })

  it('keeps the Garmin measurement available for load analysis', () => {
    const prompt = completedActivityPrompt(raceContext([officialResult]), escher)

    expect(prompt.garminMeasured).toEqual({ distanceKm: 5.25, durationSeconds: 1_310, paceSecPerKm: 249.5 })
    expect(prompt.avgHeartRate).toBe(196)
  })

  it('includes the race pacing trend computed from real laps', () => {
    const prompt = completedActivityPrompt(raceContext([officialResult]), escher) as { raceExecution?: { trend: Record<string, number> } }

    expect(prompt.raceExecution?.trend).toMatchObject({ firstFullLapPaceSecPerKm: 236, lastFullLapPaceSecPerKm: 255, positiveSplitSecPerKm: 19 })
  })

  it('keeps the original flat shape when no official result is linked', () => {
    const prompt = completedActivityPrompt(raceContext([]), escher)

    expect(prompt).toMatchObject({ id: 'escher', date: '2026-09-05', type: 'Race', distanceKm: 5.25, durationSeconds: 1_310, paceSecPerKm: 249.5, avgHeartRate: 196, rpe: 10 })
    expect(prompt).not.toHaveProperty('performance')
    expect(prompt).not.toHaveProperty('garminMeasured')
  })

  it('needs no free-text note parsing to resolve the source', () => {
    const prompt = completedActivityPrompt(raceContext([officialResult]), escher)

    expect(JSON.stringify(prompt)).not.toContain('comment')
    expect((prompt.performance as { source: string }).source).toBe('official')
  })
})

describe('model pool fallback', () => {
  const refused = { ok: false, reason: 'http 503: high demand' }

  const input = () => ({
    context: context(),
    availableWeekdays: [0, 2, 3, 4, 6],
    runsPerWeek: 5,
    planningStartDate: '2026-09-22',
    primaryTargetEvent: {
      id: 'primary', name: '10 km', date: '2026-11-29', role: 'primary' as const,
      distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
    },
    tuneUpEvents: [],
    horizonEndDate: '2026-10-19',
    macrocycleStartDate: '2026-09-01',
  })

  const modelsTried = () =>
    gemini.generateStructuredJson.mock.calls.map(([request]) => (request as { model: string }).model)

  beforeEach(() => gemini.generateStructuredJson.mockReset())

  it('tries the next model when one refuses, rather than giving up on the first', async () => {
    gemini.generateStructuredJson.mockResolvedValue(refused)

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow(/503/)

    expect(new Set(modelsTried()).size).toBeGreaterThan(1)
  })

  it('stops at the first model that answers', async () => {
    gemini.generateStructuredJson
      .mockResolvedValueOnce(refused)
      .mockResolvedValueOnce({ ok: true, value: { weeks: [] } })

    await new GeminiCoachingAdvisor().bootstrap(input()).catch(() => {})

    expect(modelsTried()).toHaveLength(2)
  })

  it('respects an explicitly chosen model instead of ranging over the pool', async () => {
    vi.stubEnv('GEMINI_COACH_MODEL', 'gemini-flash-latest')
    gemini.generateStructuredJson.mockResolvedValue(refused)

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow()

    expect(new Set(modelsTried())).toEqual(new Set(['gemini-flash-latest']))
  })
})

describe('daily quota exhaustion', () => {
  const input = () => ({
    context: context(),
    availableWeekdays: [0, 2, 3, 4, 6],
    runsPerWeek: 5,
    planningStartDate: '2026-09-22',
    primaryTargetEvent: {
      id: 'primary', name: '10 km', date: '2026-11-29', role: 'primary' as const,
      distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
    },
    tuneUpEvents: [],
    horizonEndDate: '2026-10-19',
    macrocycleStartDate: '2026-09-01',
  })

  beforeEach(() => gemini.generateStructuredJson.mockReset())

  it('spends one request per model, because the pooled models allow 20 a day', async () => {
    gemini.generateStructuredJson.mockResolvedValue({ ok: false, reason: 'http 503: high demand' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow()

    // The pool walk is the retry; retrying each model as well would treble the spend.
    expect(gemini.generateStructuredJson.mock.calls).toHaveLength(MODEL_POOL.length)
    for (const [, , retries] of gemini.generateStructuredJson.mock.calls) expect(retries).toBe(0)
  })

  it('names the daily quota when every model refuses, since Google calls it high demand', async () => {
    gemini.generateStructuredJson.mockResolvedValue({ ok: false, reason: 'http 503: high demand' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow(/Every pooled model refused/)
  })

  it('does not blame quota when a model failed for its own reason', async () => {
    gemini.generateStructuredJson.mockResolvedValue({ ok: false, reason: 'http 400: bad schema' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.not.toThrow(/quota/)
  })
})

describe('a pinned model', () => {
  const input = () => ({
    context: context(),
    availableWeekdays: [0, 2, 3, 4, 6],
    runsPerWeek: 5,
    planningStartDate: '2026-09-22',
    primaryTargetEvent: {
      id: 'primary', name: '10 km', date: '2026-11-29', role: 'primary' as const,
      distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
    },
    tuneUpEvents: [],
    horizonEndDate: '2026-10-19',
    macrocycleStartDate: '2026-09-01',
  })

  beforeEach(() => gemini.generateStructuredJson.mockReset())

  it('does not claim the pool was tried when one model was pinned', async () => {
    vi.stubEnv('GEMINI_COACH_MODEL', 'gemini-3.8-flash')
    gemini.generateStructuredJson.mockResolvedValue({ ok: false, reason: 'http 503: high demand' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow(
      /Only gemini-3\.8-flash was tried[^]*Unset it to let the whole pool answer/,
    )
  })
})

describe('pacing against the per-minute limit', () => {
  const input = () => ({
    context: context(),
    availableWeekdays: [0, 2, 3, 4, 6],
    runsPerWeek: 5,
    planningStartDate: '2026-09-22',
    primaryTargetEvent: {
      id: 'primary', name: '10 km', date: '2026-11-29', role: 'primary' as const,
      distanceLabel: '10K', distanceMeters: 10_000, targetSeconds: 2_400,
    },
    tuneUpEvents: [],
    horizonEndDate: '2026-10-19',
    macrocycleStartDate: '2026-09-01',
  })

  it('waits between pooled attempts so one command cannot outrun five requests a minute', async () => {
    const waits: number[] = []
    let clock = 1_000_000
    pacing.lastRequestAt = 0
    pacing.now = () => clock
    pacing.sleep = (ms: number) => { waits.push(ms); clock += ms; return Promise.resolve() }
    gemini.generateStructuredJson.mockReset().mockResolvedValue({ ok: false, reason: 'http 503: high demand' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow()

    // First call is free; each later one waits out the 5/min allowance.
    expect(waits).toHaveLength(MODEL_POOL.length - 1)
    expect(waits.every((ms) => ms >= 12_000)).toBe(true)
  })

  it('does not wait when the allowance has already elapsed', async () => {
    const waits: number[] = []
    let clock = 1_000_000
    pacing.lastRequestAt = 0
    pacing.now = () => (clock += 60_000)
    pacing.sleep = (ms: number) => { waits.push(ms); return Promise.resolve() }
    gemini.generateStructuredJson.mockReset().mockResolvedValue({ ok: false, reason: 'http 503: high demand' })

    await expect(new GeminiCoachingAdvisor().bootstrap(input())).rejects.toThrow()

    expect(waits).toEqual([])
  })
})

// Design review, Oct 2026: a change to the live plan names the sessions it
// writes, so it is told the naming rules a block is.
describe('a change to the live plan', () => {
  it('is asked to name what it adds or rewrites by the naming rules', async () => {
    gemini.generateStructuredJson.mockReset().mockResolvedValue({
      ok: true,
      value: { outcome: 'KEEP', reasonCodes: ['ON_PLAN'], summary: 'The plan stands.', evidence: [], changes: [] },
    })

    await new GeminiCoachingAdvisor().reviewWeek({ context: context() })

    const request = gemini.generateStructuredJson.mock.calls.at(-1)?.[0] as { systemInstruction: string }
    expect(request.systemInstruction).toContain('Name every workout you add or rewrite by these rules')
    expect(request.systemInstruction).toContain(WORKOUT_NAMING_INSTRUCTION)
  })
})
