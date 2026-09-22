import { describe, expect, it } from 'vitest'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import { validateDraftVolume, volumeBand, weekKm } from '../volume'

// Adam in September 2026: a travel-thinned month over a season that peaked at 59.5 km.
const HISTORY = {
  recent7DaysKm: 45, recent28DaysKm: 95.8, recent28DaysRuns: 13,
  recentWeeklyAverageKm: 23.9, recentWeeklyAverageRuns: 3.25,
  historicalPeakWeekKm: 59.5, historicalPeakWeekRuns: 5,
  best4WeekAverageKm: 57.4, best6WeekAverageKm: 55, best8WeekAverageKm: 54.4,
  best12WeekAverageKm: 52.8, typicalFrequencyAtPeak: 5,
  daysSinceLastRun: 1, longestRecentGapDays: 7,
} satisfies TrainingHistory

const easy = (metres: number) => ({ kind: 'effort' as const, target: { distanceMeters: metres } })
const timedThreshold = (reps: number, seconds: number) => ({
  kind: 'repeat' as const,
  repetitions: reps,
  steps: [{ kind: 'effort' as const, target: { durationSeconds: seconds, paceSecPerKm: { min: 258, max: 268 } } }],
})

function week(focus: string, blocks: BootstrapWeekDraft['workouts'][number]['blocks'][], start = '2026-09-28'): BootstrapWeekDraft {
  const end = new Date(Date.parse(start) + 6 * 86_400_000).toISOString().slice(0, 10)
  return {
    startDate: start,
    endDate: end,
    focus,
    workouts: blocks.map((b, i) => ({ date: start, type: 'easy' as const, title: `w${i}`, description: '', blocks: b })),
  }
}

const draft = (...weeks: BootstrapWeekDraft[]): CoachingPlanDraft => ({ name: 'block', focus: 'build', weeks })

describe('counting a week', () => {
  it('counts threshold work prescribed by time, not only by distance', () => {
    // 4 x 20 min at ~4:23/km is over 18 km that distanceMeters alone would miss.
    const heavy = week('Build week', [[easy(9000)], [timedThreshold(4, 1200)], [easy(9000)], [easy(16000)]])
    expect(weekKm(heavy)).toBeGreaterThan(50)
  })

  it('ignores a partial week, which cannot be judged against a weekly figure', () => {
    const tail = { startDate: '2026-10-19', endDate: '2026-10-19', focus: 'boundary', workouts: [] }
    expect(() => validateDraftVolume(draft(tail), volumeBand(HISTORY))).not.toThrow()
  })
})

describe('validateDraftVolume', () => {
  const band = volumeBand(HISTORY)

  it('accepts a week that builds from where the athlete actually is', () => {
    expect(() => validateDraftVolume(draft(week('Build', [[easy(9000)], [easy(8000)], [easy(10000)], [easy(8000)], [easy(13000)]])), band)).not.toThrow()
  })

  it('rejects the week that claimed 52 km and prescribed 62', () => {
    // The real week 4: warmup 2 km, 4 x 20 min threshold, cooldown 2 km.
    const overcooked = week('Progress volume to 52 km.', [[easy(9000)], [easy(6000)], [easy(2000), timedThreshold(4, 1200), easy(2000)], [easy(9000)], [easy(16000)]])
    expect(() => validateDraftVolume(draft(overcooked), band)).toThrow(/says 52 km .* prescribes/)
  })

  it('rejects a week beyond anything the athlete has sustained', () => {
    const beyond = week('Big block', [[easy(20000)], [easy(20000)], [easy(15000)], [easy(15000)]])
    expect(() => validateDraftVolume(draft(beyond), band)).toThrow(/beyond the .* sustained/)
  })

  it('rejects a timid week that drops below what they just ran', () => {
    const timid = week('Establish a baseline', [[easy(8000)], [easy(6000)], [easy(7000)], [easy(8000)]])
    expect(() => validateDraftVolume(draft(timid), band)).toThrow(/against a recent 45 km/)
  })

  it('allows a light week when the focus says why, exactly as reduced frequency is allowed', () => {
    const cutback = week('Planned cutback week to absorb the block.', [[easy(8000)], [easy(6000)], [easy(7000)], [easy(8000)]])
    expect(() => validateDraftVolume(draft(cutback), band)).not.toThrow()
  })

  it('rejects a jump too big to absorb, even when both weeks are within capacity', () => {
    const first = week('Steady', [[easy(10000)], [easy(10000)], [easy(10000)], [easy(9000)]], '2026-09-28')
    const leap = week('Steady', [[easy(15000)], [easy(15000)], [easy(14000)], [easy(11000)]], '2026-10-05')
    expect(() => validateDraftVolume(draft(first, leap), band)).toThrow(/jumps from/)
  })

  it('says nothing when there is no history to judge against', () => {
    const empty = { ...HISTORY, recent7DaysKm: 0, recentWeeklyAverageKm: 0, best4WeekAverageKm: 0 }
    const anything = week('Whatever', [[easy(30000)]])
    expect(() => validateDraftVolume(draft(anything), volumeBand(empty))).not.toThrow()
  })
})
