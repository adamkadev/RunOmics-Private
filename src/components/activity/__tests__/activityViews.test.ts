import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { activityDetailView, runName, sessionTypes, shareActivity, shownType } from '../activityViews'

const ACTIVITY = {
  id: '90000273',
  week: 202639,
  date: '2026-09-24',
  dayOfWeek: 'Thursday',
  type: 'Base',
  description: 'Morning run',
  comment: 'legs heavy after the flight',
  durationSeconds: 3000,
  distanceKm: 10,
  paceSecPerKm: 300,
  hrZones: [],
  avgHeartRate: 140,
  rpe: 3,
  route: [[6.1, 49.6], [6.2, 49.7]],
  elevationGain: 80,
  aerTrainingEffect: 2.8,
  anaTrainingEffect: 0.4,
  hrSamples: [130, 140],
  elevationProfile: [300, 310],
  calories: 640,
  cadenceSpm: 172,
  groundContactMs: 240,
  verticalOscillationMm: 82,
  verticalRatioPct: 7.4,
  strideLengthM: 1.1,
  bestEfforts: null,
  splits: null,
  paceSamples: [300, 298],
  vo2maxGarmin: 54,
  avgTemperature: 18,
  cadenceSamples: [170, 174],
  gearId: 'gear-1',
  weather: null,
} satisfies Activity

describe('activityDetailView', () => {
  it('leaves out what no client component on the page draws', () => {
    const view = activityDetailView(ACTIVITY)

    for (const key of ['comment', 'description', 'calories', 'gearId', 'vo2maxGarmin', 'avgTemperature', 'week']) {
      expect(view, key).not.toHaveProperty(key)
    }
  })

  it('keeps the map, the samples and the stats', () => {
    const view = activityDetailView(ACTIVITY)

    expect(view.route).toBe(ACTIVITY.route)
    expect(view.hrSamples).toBe(ACTIVITY.hrSamples)
    expect(view.distanceKm).toBe(10)
    expect(view.bestEfforts).toBeNull()
  })
})

describe('shareActivity', () => {
  it('carries the card, its route and the zone times, nothing else: no stream', () => {
    expect(Object.keys(shareActivity(ACTIVITY)).sort()).toEqual(
      [
        'avgHeartRate', 'date', 'dayOfWeek', 'description', 'distanceKm', 'durationSeconds', 'elevationGain',
        'hrZones', 'id', 'paceSecPerKm', 'reps', 'route', 'sessionTitle', 'type', 'verdict',
      ].sort()
    )
  })

  it('carries the written verdict\'s headline and the Overview card\'s tone', () => {
    expect(shareActivity(ACTIVITY, null, { headline: ' Usual long-run pace, 7 bpm cheaper. ' }).verdict)
      .toEqual({ tone: 'positive', headline: 'Usual long-run pace, 7 bpm cheaper.' })
    expect(shareActivity({ ...ACTIVITY, rpe: 9 }, null, { headline: 'Too hard' }).verdict?.tone).toBe('caution')
  })

  it('has no verdict without a written one, so the card keeps its zones headline', () => {
    expect(shareActivity(ACTIVITY).verdict).toBeNull()
    expect(shareActivity(ACTIVITY, null, { headline: '  ' }).verdict).toBeNull()
  })
})

const lap = (type: ActivitySplit['type'], durationSec: number, distanceM: number): ActivitySplit =>
  ({ type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr: null, laps: [] })

// 3 x 8' at 4:24/km between 2' jogs, inside a warm-up and a cool-down.
const SPLITS = [
  lap('interval_warmup', 900, 2500),
  ...[1, 2, 3].flatMap(() => [lap('interval_active', 480, 1818), lap('interval_recovery', 120, 300)]),
  lap('interval_cooldown', 600, 1600),
]

const SESSION = {
  type: 'threshold',
  title: 'Threshold · 3 × 8′ @ 4:25',
  structure: { reps: 3, repMinutes: 8, targetPace: '4:25' },
  blocks: [],
} as unknown as WorkoutPrescription

describe('the share card of an interval session (design review, Oct 2026)', () => {
  const run: Activity = { ...ACTIVITY, type: 'Tempo', splits: SPLITS }

  it('takes the coach\'s name and kind for the session the run matched', () => {
    const card = shareActivity(run, SESSION)
    expect(card.sessionTitle).toBe('Threshold · 3 × 8′ @ 4:25')
    expect(card.type).toBe('Threshold')
  })

  it('reads the reps off the work laps only, with the plan\'s pace for them', () => {
    expect(shareActivity(run, SESSION).reps).toMatchObject({ count: 3, repSeconds: 480, paceSecPerKm: 264, target: { min: 265, max: 265 } })
  })

  it('places each rep along the run, the laps laid end to end', () => {
    const total = 2500 + 3 * (1818 + 300) + 1600
    const windows = shareActivity(run, SESSION).reps!.windows
    expect(windows).toHaveLength(3)
    expect(windows[0]![0]).toBeCloseTo(2500 / total)
    expect(windows[0]![1]).toBeCloseTo(4318 / total)
    expect(windows[2]![1]).toBeCloseTo((total - 1600 - 300) / total)
  })

  // The coach matched nothing; the watch's own plan for the day still holds
  // the band it beeped at.
  it('falls back to the planned workout\'s effort step when the coach matched none', () => {
    const planned = {
      date: '2026-10-13',
      name: "Threshold 2 x 7:00 - 2x7'@4:25",
      steps: [
        { kind: 'warmup' as const, minutes: 12, paceSecPerKm: [330, 384] as [number, number] },
        { kind: 'effort' as const, minutes: 7, paceSecPerKm: [262, 268] as [number, number] },
        { kind: 'recovery' as const, minutes: 4, paceSecPerKm: [360, 420] as [number, number] },
      ],
    }
    expect(shareActivity(run, null, null, planned).reps?.target).toEqual({ min: 262, max: 268 })
    // The coach's own pace still wins where there is one.
    expect(shareActivity(run, SESSION, null, planned).reps?.target).toEqual({ min: 265, max: 265 })
    expect(shareActivity(run, null, null, null).reps?.target).toBeNull()
  })

  it('takes the target from the repeat\'s effort step when the name sets none', () => {
    const blocks = [{ kind: 'repeat', steps: [{ kind: 'effort', target: { paceSecPerKm: { min: 262.4, max: 268.6 } } }] }]
    const session = { ...SESSION, structure: undefined, blocks } as unknown as WorkoutPrescription
    expect(shareActivity(run, session).reps?.target).toEqual({ min: 262, max: 269 })
  })

  it('titles the card with the session\'s name as the plan shows it', () => {
    const legacy = { ...SESSION, title: 'Threshold 3 x 7:40', structure: undefined } as unknown as WorkoutPrescription
    expect(shareActivity(run, legacy).sessionTitle).toBe('Threshold 3 x 7:40')
    const strides = {
      type: 'easy',
      title: 'Strides 6 x 20s',
      blocks: [
        { kind: 'effort', target: { distanceMeters: 9000, paceSecPerKm: { min: 330, max: 384 }, hrZone: 2 } },
        {
          kind: 'repeat', repetitions: 6, steps: [
            { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 215, max: 230 } } },
            { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 360, max: 420 } } },
          ],
        },
      ],
    } as unknown as WorkoutPrescription
    expect(shareActivity({ ...ACTIVITY, description: 'Strides 6 x 20s' }, strides).sessionTitle).toBe('Easy 54 min + 6 × 20s strides')
    // The page's header reads the same name, the watch's only without a session.
    expect(runName({ ...ACTIVITY, description: 'Strides 6 x 20s' }, strides)).toBe('Easy 54 min + 6 × 20s strides')
    expect(runName({ ...ACTIVITY, description: 'Strides 6 x 20s' }, null)).toBe('Strides 6 x 20s')
  })

  it('has no reps for an easy run, nor for one the watch kept no rep laps for', () => {
    expect(shareActivity({ ...run, type: 'Base' }).reps).toBeNull()
    expect(shareActivity({ ...run, splits: null }, SESSION).reps).toBeNull()
  })
})

// A threshold session Garmin files as tempo, its heart rate too low, shows as the threshold it was set as.
describe('the type a run is shown as', () => {
  const at = (date: string, type: WorkoutPrescription['type'], activityId: string | null = null) => ({
    prescription: { id: `w-${date}-${type}`, date, type, status: 'planned' } as unknown as WorkoutPrescription,
    activityId,
  })
  const run = { id: 'run-1', date: '2026-10-13', type: 'Tempo' as const, description: 'Morning Run' }

  it("is the session's, where it has one, else the one its name says, else the watch's", () => {
    expect(shownType(run, at('2026-10-13', 'threshold').prescription)).toBe('Threshold')
    expect(shownType(run, null)).toBe('Tempo')
    // No session the app can match: the name says what each was set as.
    expect(shownType({ ...run, description: "Threshold 2 x 7:00 - 2x7'@4:25" }, null)).toBe('Threshold')
    expect(shownType({ ...run, description: 'Base' }, null)).toBe('Base')
  })

  it('lists only the runs whose session differs from the watch, matched as the share card matches them', () => {
    const easy = { id: 'run-2', date: '2026-10-14', type: 'Base' as const, description: 'Morning Run' }
    const tempo = { id: 'run-3', date: '2026-10-15', type: 'Tempo' as const, description: 'Morning Run' }
    const workouts = [at('2026-10-13', 'threshold'), at('2026-10-14', 'easy'), at('2026-10-15', 'tempo')]
    expect(sessionTypes(workouts, [run, easy, tempo])).toEqual({ 'run-1': 'Threshold' })
    // An easy run on a hard day takes no session, and keeps its own type.
    expect(sessionTypes([at('2026-10-14', 'threshold')], [easy])).toEqual({})
    // With no session, by its name: a threshold the watch filed as tempo.
    expect(sessionTypes([], [{ ...run, description: "Threshold 2 x 7:00 - 2x7'@4:25" }])).toEqual({ 'run-1': 'Threshold' })
  })
})
