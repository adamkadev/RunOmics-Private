import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '@/domain/activity/types'
import { t } from '@/i18n'
import { watchAlerts, watchAlertsLine } from '../watchAlerts'

const WALK: [number, number] = [660, 840]
const runWalk = (runPace?: [number, number]): WorkoutStep[] => [
  { kind: 'warmup', minutes: 5, seconds: 300, paceSecPerKm: WALK },
  ...[1, 2, 3].flatMap((rep): WorkoutStep[] => [
    { kind: 'effort', minutes: 3, seconds: 180, rep, ...(runPace ? { paceSecPerKm: runPace } : {}) },
    ...(rep < 3 ? [{ kind: 'recovery', minutes: 1, seconds: 60, rep } as WorkoutStep] : []),
  ]),
  { kind: 'cooldown', minutes: 5, seconds: 300, paceSecPerKm: WALK },
]
const THRESHOLD: WorkoutStep[] = [
  { kind: 'warmup', minutes: 15, seconds: 900 },
  ...[1, 2, 3].flatMap((rep): WorkoutStep[] => [
    { kind: 'effort', minutes: 8, seconds: 480, rep, paceSecPerKm: [272, 280] },
    { kind: 'recovery', minutes: 2, seconds: 90, rep },
  ]),
  { kind: 'cooldown', minutes: 10, seconds: 600 },
]
const STRIDES: WorkoutStep[] = [
  { kind: 'effort', minutes: 40, seconds: 2_400, paceSecPerKm: [330, 384] },
  ...[1, 2, 3, 4].flatMap((rep): WorkoutStep[] => [
    { kind: 'effort', minutes: 1, seconds: 20, rep, paceSecPerKm: [215, 225] },
    { kind: 'recovery', minutes: 1, seconds: 60, rep },
  ]),
]

describe('watchAlerts', () => {
  it('reads a run/walk session as one run time, one walk time and the running pace', () => {
    const alerts = watchAlerts(runWalk([470, 525]), 'easy')
    expect(alerts).toEqual({ runWalk: { runSeconds: 180, walkSeconds: 60 }, pace: [470, 525] })
    expect(watchAlertsLine(alerts!)).toBe(`${t.plan.session.runWalkAlert('3:00', '1:00')} · ${t.plan.session.paceAlert(`7:50–8:45 ${t.units.perKm}`)}`)
  })

  it('gives a run/walk session without a running pace its Run/Walk alert alone', () => {
    expect(watchAlerts(runWalk(), 'easy')).toEqual({ runWalk: { runSeconds: 180, walkSeconds: 60 }, pace: null })
  })

  it('gives a quality session its reps’ pace and no Run/Walk', () => {
    expect(watchAlerts(THRESHOLD, 'quality')).toEqual({ runWalk: null, pace: [272, 280] })
  })

  it('reads an easy run with strides by its easy pace, not as run/walk', () => {
    expect(watchAlerts(STRIDES, 'easy')).toEqual({ runWalk: null, pace: [330, 384] })
  })

  it('has nothing to say when the running steps change length and carry no pace', () => {
    const pyramid: WorkoutStep[] = [
      { kind: 'effort', minutes: 2, seconds: 120 },
      { kind: 'recovery', minutes: 1, seconds: 60 },
      { kind: 'effort', minutes: 4, seconds: 240 },
    ]
    expect(watchAlerts(pyramid, 'easy')).toBeNull()
    expect(watchAlerts(null, 'easy')).toBeNull()
  })
})
