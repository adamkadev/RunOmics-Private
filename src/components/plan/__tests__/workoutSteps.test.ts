import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '@/domain/activity/types'
import { WORKOUT_SEGMENT_COLORS } from '@/lib/colors'
import { t } from '@/i18n'
import { intensityBlocks, stepLength, stepRows } from '../workoutSteps'

const COLOR = 'var(--zone-4)'
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

describe('the intensity profile', () => {
  it('draws each step as long as it lasts, the work in the session’s colour', () => {
    const blocks = intensityBlocks(THRESHOLD, 3_480, COLOR)
    expect(blocks.map((b) => b.tone)).toEqual(['ease', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'ease'])
    expect(blocks.map((b) => b.seconds)).toEqual([900, 480, 90, 480, 90, 480, 90, 600])
    expect(blocks[0]!.fill).toBe(WORKOUT_SEGMENT_COLORS.warmup)
    expect(blocks[1]!.fill).toBe(COLOR)
    expect(blocks[2]!.fill).toBe(WORKOUT_SEGMENT_COLORS.warmup)
  })

  it('drops the jog after the last rep and draws strides at max', () => {
    const blocks = intensityBlocks(STRIDES, 2_720, 'var(--zone-2)')
    expect(blocks.at(-1)!.tone).toBe('work')
    expect(blocks[0]!.fill).toBe('var(--zone-2)')
    expect(blocks[1]!.fill).toBe('var(--zone-5)')
  })

  it('is one block for a session without steps', () => {
    expect(intensityBlocks(null, 3_600, COLOR)).toEqual([{ tone: 'work', seconds: 3_600, fill: COLOR }])
  })
})

describe('the steps list', () => {
  it('groups the reps into one row between the warm-up and the cool-down', () => {
    const rows = stepRows({ steps: THRESHOLD, type: 'Threshold', kind: 'quality', color: COLOR, totalSeconds: 3_480 })
    expect(rows.map((r) => [r.title, r.detail, r.duration])).toEqual([
      [t.plan.steps.warmup, t.plan.steps.easy, '15′'],
      [t.plan.steps.reps(3, '8′', t.activityTypes.Threshold.toLowerCase()), 'Z4 · 4:32–4:40 /km · 1:30 rec', '27′'],
      [t.plan.steps.cooldown, t.plan.steps.easy, '10′'],
    ])
  })

  it('counts every part of a warm-up in steps, with each part’s pace', () => {
    const warmups: WorkoutStep[] = [
      { kind: 'warmup', minutes: 10, seconds: 607, paceSecPerKm: [330, 384] },
      { kind: 'warmup', minutes: 5, seconds: 299, paceSecPerKm: [292, 305] },
      { kind: 'warmup', minutes: 5, seconds: 286, paceSecPerKm: [280, 292] },
    ]
    const rows = stepRows({ steps: [...warmups, ...THRESHOLD.slice(1)], type: 'Threshold', kind: 'quality', color: COLOR, totalSeconds: 3_772 })
    expect(rows[0]).toMatchObject({ title: t.plan.steps.warmup, detail: '5:30–6:24 → 4:52–5:05 → 4:40–4:52 /km', duration: '19:52' })
  })

  it('reads an easy run with strides as its body and its strides', () => {
    const rows = stepRows({ steps: STRIDES, type: 'Base', kind: 'easy', color: 'var(--zone-2)', totalSeconds: 2_720 })
    expect(rows.map((r) => r.title)).toEqual([t.plan.kinds.easy, t.plan.steps.strides(4, '20s')])
    expect(rows[1]!.duration).toBe('4:20')
    expect(rows[1]!.fill).toBe('var(--zone-5)')
  })

  it('is one row for a session without steps, its pace from the effort', () => {
    const rows = stepRows({ steps: null, type: 'Base', kind: 'long', color: 'var(--zone-2)', totalSeconds: 5_400, pace: '5:30–6:24 /km' })
    expect(rows).toEqual([{ key: 'main', tone: 'work', fill: 'var(--zone-2)', title: t.plan.kinds.long, detail: 'Z2 · 5:30–6:24 /km', duration: `1:30 ${t.units.hour}` }])
  })

  it('writes whole minutes with a prime and the rest as a clock', () => {
    expect(stepLength(480)).toBe('8′')
    expect(stepLength(90)).toBe('1:30')
    expect(stepLength(20)).toBe('20s')
  })
})
