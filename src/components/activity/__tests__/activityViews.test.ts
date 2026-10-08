import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { activityDetailView, shareActivity, shareSession } from '../activityViews'

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
  polyline: 'encoded-route',
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

    for (const key of ['polyline', 'comment', 'description', 'calories', 'gearId', 'vo2maxGarmin', 'avgTemperature', 'week']) {
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
        'hrZones', 'id', 'paceSecPerKm', 'reps', 'route', 'sessionTitle', 'type',
      ].sort()
    )
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

  // The route draws the reps where they ran (design review, Oct 2026).
  it('places each rep along the run, the laps laid end to end', () => {
    const total = 2500 + 3 * (1818 + 300) + 1600
    const windows = shareActivity(run, SESSION).reps!.windows
    expect(windows).toHaveLength(3)
    expect(windows[0]![0]).toBeCloseTo(2500 / total)
    expect(windows[0]![1]).toBeCloseTo(4318 / total)
    expect(windows[2]![1]).toBeCloseTo((total - 1600 - 300) / total)
  })

  it('takes the target from the repeat\'s effort step when the name sets none', () => {
    const blocks = [{ kind: 'repeat', steps: [{ kind: 'effort', target: { paceSecPerKm: { min: 262.4, max: 268.6 } } }] }]
    const session = { ...SESSION, structure: undefined, blocks } as unknown as WorkoutPrescription
    expect(shareActivity(run, session).reps?.target).toEqual({ min: 262, max: 269 })
  })

  // Design review, Oct 2026: the plan's name for the session, never one the card derives.
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
  })

  it('has no reps for an easy run, nor for one the watch kept no rep laps for', () => {
    expect(shareActivity({ ...run, type: 'Base' }).reps).toBeNull()
    expect(shareActivity({ ...run, splits: null }, SESSION).reps).toBeNull()
  })
})

describe('shareSession', () => {
  const at = (date: string, type: string, extra: object = {}) =>
    ({ prescription: { id: `${date}-${type}`, date, type, status: 'planned', ...extra } as unknown as WorkoutPrescription, activityId: null as string | null })
  const run = { id: 'run-1', date: '2026-10-06T07:00:00', type: 'Tempo' as const }

  it('takes the session the coach matched the run to', () => {
    const matched = { ...at('2026-10-01', 'tempo'), activityId: 'run-1' }
    expect(shareSession([at('2026-10-06', 'threshold'), matched], run)).toBe(matched.prescription)
  })

  // The coach matches on kind: a threshold session the watch filed as tempo matched nothing.
  it('else takes the one quality session set for a quality run\'s day', () => {
    const day = at('2026-10-06', 'threshold')
    expect(shareSession([at('2026-10-05', 'easy'), day], run)).toBe(day.prescription)
  })

  // As Today pairs them (design review, Oct 2026): the strides day's easy run is that session.
  it('takes the day\'s easy session for an easy run', () => {
    const day = at('2026-10-06', 'easy')
    expect(shareSession([day], { ...run, type: 'Base' })).toBe(day.prescription)
  })

  it('takes none for an easy run on a hard day, a cancelled session, or a day of two', () => {
    expect(shareSession([at('2026-10-06', 'threshold')], { ...run, type: 'Base' })).toBeNull()
    expect(shareSession([at('2026-10-06', 'threshold', { status: 'cancelled' })], run)).toBeNull()
    expect(shareSession([at('2026-10-06', 'easy')], run)).toBeNull()
    expect(shareSession([at('2026-10-06', 'threshold'), at('2026-10-06', 'tempo')], run)).toBeNull()
  })
})
