import { describe, expect, it } from 'vitest'
import { expectedRpe, runVerdictTone } from '../runVerdict'
import type { Activity } from '../types'

type Effort = Pick<Activity, 'type' | 'distanceKm' | 'durationSeconds' | 'rpe' | 'aerTrainingEffect'>

const run = (overrides: Partial<Effort>): Effort => ({
  type: 'Base',
  distanceKm: 10,
  durationSeconds: 55 * 60,
  rpe: null,
  aerTrainingEffect: null,
  ...overrides,
})

describe('expectedRpe', () => {
  it('sets a race band from its distance rather than the label', () => {
    expect(expectedRpe(run({ type: 'Race', distanceKm: 5 }))).toEqual([9, 10])
    expect(expectedRpe(run({ type: 'Race', distanceKm: 21.1 }))).toEqual([7, 9])
    expect(expectedRpe(run({ type: 'Race', distanceKm: 42.2 }))).toEqual([6, 8])
    expect(expectedRpe(run({ type: 'Race', distanceKm: 80 }))).toEqual([4, 8])
  })

  it('lets an easy run drift upward once it goes long', () => {
    expect(expectedRpe(run({ durationSeconds: 50 * 60 }))).toEqual([1, 3])
    expect(expectedRpe(run({ durationSeconds: 120 * 60 }))).toEqual([1, 5])
  })
})

describe('runVerdictTone', () => {
  it('reads a hard threshold session as the intent, not a warning', () => {
    expect(runVerdictTone(run({ type: 'Threshold', rpe: 8 }))).toBe('positive')
  })

  it('reads the same effort on an easy day as overshooting', () => {
    expect(runVerdictTone(run({ rpe: 8 }))).toBe('caution')
  })

  it('softens one point over the band to a remark rather than a warning', () => {
    expect(runVerdictTone(run({ rpe: 4 }))).toBe('neutral')
    expect(runVerdictTone(run({ rpe: 5 }))).toBe('caution')
  })

  it('still counts a session run one point under its band as executed', () => {
    expect(runVerdictTone(run({ type: 'Threshold', rpe: 6 }))).toBe('positive')
    expect(runVerdictTone(run({ type: 'Threshold', rpe: 5 }))).toBe('neutral')
  })

  it('does not flag a long run rated harder than a short one would be', () => {
    expect(runVerdictTone(run({ rpe: 5, durationSeconds: 120 * 60 }))).toBe('positive')
    expect(runVerdictTone(run({ rpe: 5, durationSeconds: 50 * 60 }))).toBe('caution')
  })

  it('reads a marathon at RPE 7 as raced, where a 5K at 7 is under-raced', () => {
    expect(runVerdictTone(run({ type: 'Race', distanceKm: 42.2, rpe: 7 }))).toBe('positive')
    expect(runVerdictTone(run({ type: 'Race', distanceKm: 5, rpe: 7 }))).toBe('neutral')
  })

  it('flags an overreaching training effect whatever the effort felt like', () => {
    expect(runVerdictTone(run({ rpe: 2, aerTrainingEffect: 4.9 }))).toBe('caution')
  })

  it('does not flag an overreaching training effect in a race, where it is the point', () => {
    expect(runVerdictTone(run({ type: 'Race', distanceKm: 10, rpe: 9, aerTrainingEffect: 4.9 }))).toBe('positive')
  })

  it('falls back to the training effect when no RPE was logged', () => {
    expect(runVerdictTone(run({ aerTrainingEffect: 3.2 }))).toBe('positive')
    expect(runVerdictTone(run({ aerTrainingEffect: 1.5 }))).toBe('neutral')
    expect(runVerdictTone(run({}))).toBe('neutral')
  })
})
