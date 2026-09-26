import { describe, expect, it } from 'vitest'
import { coachWorkoutView } from '../planWorkoutView'
import { paceLabel, repCaption, workoutSummary } from '../workoutSummary'
import { todaySession } from '@/components/dashboard/todaySession'
import { heroWorkoutView } from '../planWorkoutView'
import { t } from '@/i18n'

// The session that read "Strides 6 × 20s · 59 min · 3:35–7:00/km" on Today
// and "6 × 1:00 · 1:00 rec · 3:35–6:24" on Plan (H02).
const STRIDES = {
  state: 'planned',
  activityId: null,
  garminStatus: null,
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
    expect(todaySession(heroWorkoutView(view), null).title).toBe(summary.title)
  })
})
