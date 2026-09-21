import { expect, it } from 'vitest'
import { withCourseAwareRacePacing } from '../coursePacing'
import { plan } from './fixtures'
import { parseCoachingPlan } from '../validation'
import type { TargetEvent, WorkoutPrescription } from '../types'
const event: TargetEvent = { id: 'broscht', name: 'Broscht', date: '2026-10-03', distanceMeters: 5000, targetSeconds: 1200, courseContext: { pacingNotes: ['Slower uphill opening; faster downhill kilometres.'] } }
const workout: WorkoutPrescription = {
  ...plan().weeks[0]!.workouts[0]!, date: event.date, type: 'race',
  blocks: [
    { kind: 'warmup', target: { distanceMeters: 2000, paceSecPerKm: { min: 310, max: 387 } } },
    { kind: 'effort', target: { distanceMeters: 5000, paceSecPerKm: { min: 240, max: 240 } } },
    { kind: 'cooldown', target: { distanceMeters: 2000, paceSecPerKm: { min: 310, max: 387 } } },
  ],
}
it('replaces only the full-distance race pacing, preserving distances and the explicit finish goal', () => {
  const refined = withCourseAwareRacePacing(workout, event)
  expect(refined.blocks[1]).toMatchObject({ target: { distanceMeters: 5000 } })
  expect(refined.blocks[1]).not.toHaveProperty('target.paceSecPerKm')
  expect(refined.blocks[1]).toHaveProperty('notes', expect.arrayContaining([expect.stringContaining('Average goal pace: 4:00/km'), event.courseContext!.pacingNotes[0]]))
  expect(refined.blocks[0]).toEqual(workout.blocks[0])
  expect(refined.blocks[2]).toEqual(workout.blocks[2])
  expect(event.targetSeconds).toBe(1200)
  expect(workout.blocks[1]).toHaveProperty('target.paceSecPerKm.min', 240)
})
it('leaves generic flat races unchanged', () => {
  const flat = { ...event, courseContext: undefined }
  expect(withCourseAwareRacePacing(workout, flat)).toEqual(workout)
})
it('retains supplied variable PacePro splits and rejects contradictory splits', () => {
  const course = { ...event, courseContext: { pacingNotes: [], paceProSplits: [{ distanceMeters: 2000, targetSeconds: 510 }, { distanceMeters: 3000, targetSeconds: 690 }] } }
  const refined = withCourseAwareRacePacing(workout, course)
  expect(JSON.stringify(refined)).toContain('2000 m in 510 seconds')
  expect(JSON.stringify(refined)).toContain('3000 m in 690 seconds')
  expect(() => withCourseAwareRacePacing(workout, { ...course, targetSeconds: 1199 })).toThrow('finish goal')
})
it('preserves course context through saved-plan parsing', () => {
  const draft = plan()
  draft.targetEvent.courseContext = event.courseContext
  expect(parseCoachingPlan(draft).targetEvent.courseContext).toEqual(event.courseContext)
})
