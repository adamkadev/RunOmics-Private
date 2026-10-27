import { describe, expect, it } from 'vitest'
import type { WorkoutBlock, WorkoutPrescription } from '../types'
import { blocksMeters, isWalkSegment, planEasyPace, prescriptionMeters } from '../sessionDistance'

const EASY = { min: 470, max: 525 }

const fourthOfNovember: WorkoutBlock[] = [
  { kind: 'warmup', target: { durationSeconds: 300 } },
  { kind: 'effort', target: { durationSeconds: 900, paceSecPerKm: EASY } },
  { kind: 'cooldown', target: { durationSeconds: 300 } },
]

const session = (type: WorkoutPrescription['type'], blocks: WorkoutBlock[]) => ({ type, blocks })

describe('a session’s distance', () => {
  it('runs an untargeted warm-up and cool-down at the easy pace', () => {
    expect(Math.round(blocksMeters(fourthOfNovember))).toBe(1809)
    expect(Math.round(blocksMeters(fourthOfNovember, EASY))).toBe(3015)
  })

  it('counts untargeted recoveries inside a repeat, every repetition', () => {
    const reps: WorkoutBlock[] = [{
      kind: 'repeat',
      repetitions: 3,
      steps: [
        { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 265, max: 270 } } },
        { kind: 'recovery', target: { durationSeconds: 120 } },
      ],
    }]
    expect(blocksMeters(reps, EASY) - blocksMeters(reps)).toBeCloseTo(3 * (120 * 2_000) / 995, 6)
  })

  it('leaves out a step its notes call a walk, in either language', () => {
    const walked: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 300 }, notes: ['5 minutes de marche active pour démarrer.'] },
      fourthOfNovember[1]!,
      { kind: 'cooldown', target: { durationSeconds: 300 }, notes: ['Walk it off.'] },
    ]
    expect(blocksMeters(walked, EASY)).toBe(blocksMeters(fourthOfNovember))
  })

  it('reads a walking pace as a walk, and leaves an untargeted effort uncounted', () => {
    expect(isWalkSegment({ kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 660, max: 780 } } })).toBe(true)
    expect(isWalkSegment({ kind: 'warmup', target: { durationSeconds: 300 }, notes: ['Démarre doucement.'] })).toBe(false)
    expect(blocksMeters([{ kind: 'effort', target: { durationSeconds: 600, hrZone: 2 } }], EASY)).toBe(0)
  })

  it('keeps the distance the coach wrote for the whole session', () => {
    expect(prescriptionMeters({ blocks: fourthOfNovember, totalDistanceMeters: 4_000 }, EASY)).toBe(4_000)
    expect(prescriptionMeters({ blocks: [{ kind: 'warmup', target: {} }] }, EASY)).toBeNull()
  })
})

describe('the plan’s easy pace', () => {
  it('spans easy sessions and the paced warm-ups, never strides, quality reps or walks', () => {
    const plan = [
      session('easy', fourthOfNovember),
      session('threshold', [
        { kind: 'warmup', target: { durationSeconds: 600, paceSecPerKm: { min: 480, max: 540 } } },
        { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 265, max: 270 } } },
      ]),
      session('easy', [
        { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 240, max: 250 } } },
        { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 660, max: 780 } } },
      ]),
    ]
    expect(planEasyPace(plan)).toEqual({ min: 470, max: 540 })
    expect(planEasyPace([session('threshold', [fourthOfNovember[0]!])])).toBeNull()
  })
})
