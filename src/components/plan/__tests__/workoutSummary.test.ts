import { describe, expect, it } from 'vitest'
import { coachWorkoutView } from '../planWorkoutView'
import { paceLabel, repCaption, workoutSummary } from '../workoutSummary'
import { heroWorkoutView } from '../planWorkoutView'
import { t } from '@/i18n'

const STRIDES = {
  state: 'planned',
  activityId: null,
  prescription: {
    id: 'w1',
    date: '2026-09-26',
    type: 'easy',
    title: 'Strides 6 x 20s',
    blocks: [
      { kind: 'effort', target: { distanceMeters: 8500, paceSecPerKm: { min: 330, max: 384 }, hrZone: 2 } },
      {
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 215, max: 230 } } },
          { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 360, max: 420 } } },
        ],
      },
    ],
  },
} as unknown as Parameters<typeof coachWorkoutView>[0]

describe('workoutSummary', () => {
  const view = coachWorkoutView(STRIDES)
  const summary = workoutSummary(view)

  it('names an easy run with strides by its parts', () => {
    expect(summary.title).toBe(t.plan.session.stridesTitle(51, 6, t.plan.session.seconds(20)))
  })

  it('keeps the easy and the strides pace apart', () => {
    expect(summary.paces.map(paceLabel)).toEqual([t.plan.session.easyPace('5:30–6:24'), t.plan.session.stridesPace('3:35')])
  })

  it('writes the reps to the second, from the same steps the bar draws', () => {
    expect(repCaption(view.structure!)).toBe(t.plan.session.withRecovery(`6 × ${t.plan.session.seconds(20)}`, '1:00'))
    expect(summary.repCaption).toBe(repCaption(view.structure!))
  })

  it('gives Today the same title Plan prints', () => {
    expect(workoutSummary(heroWorkoutView(view)).title).toBe(summary.title)
  })
})

describe('a session named under the naming rules', () => {
  const named = {
    ...STRIDES,
    prescription: { ...STRIDES.prescription, title: 'Easy · 51 min + 6 strides', shortName: 'Easy + strides' },
  } as unknown as Parameters<typeof coachWorkoutView>[0]

  it('keeps its name as written, where an older one is rebuilt from its steps', () => {
    expect(workoutSummary(coachWorkoutView(named)).title).toBe('Easy · 51 min + 6 strides')
    expect(workoutSummary(coachWorkoutView(STRIDES)).title).toBe(t.plan.session.stridesTitle(51, 6, t.plan.session.seconds(20)))
  })

  it('gives a tight row its short name, else the title', () => {
    expect(workoutSummary(coachWorkoutView(named)).shortTitle).toBe('Easy + strides')
    expect(workoutSummary(coachWorkoutView(STRIDES)).shortTitle).toBe(workoutSummary(coachWorkoutView(STRIDES)).title)
  })

  it('carries the short name to Today', () => {
    expect(heroWorkoutView(coachWorkoutView(named)).shortName).toBe('Easy + strides')
    expect(heroWorkoutView(coachWorkoutView(STRIDES))).not.toHaveProperty('shortName')
  })
})
