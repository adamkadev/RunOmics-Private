import { describe, expect, it } from 'vitest'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import { validateDraftVolume, volumeBand, weekKm } from '../volume'

// Adam runs Tue, Wed, Thu, Sat, Sun.
const DAYS = [2, 3, 4, 6, 0]

// Adam in September 2026: a travel-thinned month over a season that peaked at 59.5 km.
const HISTORY = {
  recent7DaysKm: 45, recent28DaysKm: 95.8, recent28DaysRuns: 13,
  recentWeeklyAverageKm: 23.9, recentWeeklyAverageRuns: 3.25,
  historicalPeakWeekKm: 59.5, historicalPeakWeekRuns: 5,
  best4WeekAverageKm: 57.4, best6WeekAverageKm: 55, best8WeekAverageKm: 54.4,
  best12WeekAverageKm: 52.8, typicalFrequencyAtPeak: 5,
  daysSinceLastRun: 1, longestRecentGapDays: 7,
  // Adam's longest ever is a half; his longest training run is 16 km.
  longestRunLast30DaysKm: 16, longestRunLast90DaysKm: 21.1,
  // The band is drawn from the aggregates above; the series is here to satisfy
  // the type, and these tests say nothing about it.
  weeklySeries: { firstWeekStart: '2026-08-31', km: [45], runs: [5] },
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
    expect(() => validateDraftVolume(draft(tail), volumeBand(HISTORY), DAYS)).not.toThrow()
  })
})

describe('validateDraftVolume', () => {
  const band = volumeBand(HISTORY)

  it('accepts a week that builds from where the athlete actually is', () => {
    expect(() => validateDraftVolume(draft(week('Build', [[easy(9000)], [easy(8000)], [easy(10000)], [easy(8000)], [easy(13000)]])), band, DAYS)).not.toThrow()
  })

  it('rejects the week that claimed 52 km and prescribed 62', () => {
    // The real week 4: warmup 2 km, 4 x 20 min threshold, cooldown 2 km.
    const overcooked = week('Progress volume to 52 km.', [[easy(9000)], [easy(6000)], [easy(2000), timedThreshold(4, 1200), easy(2000)], [easy(9000)], [easy(16000)]])
    expect(() => validateDraftVolume(draft(overcooked), band, DAYS)).toThrow(/says 52 km .* prescribes/)
  })

  it('rejects a week beyond anything the athlete has sustained', () => {
    const beyond = week('Big block', [[easy(20000)], [easy(20000)], [easy(15000)], [easy(15000)]])
    expect(() => validateDraftVolume(draft(beyond), band, DAYS)).toThrow(/beyond the .* sustained/)
  })

  it('rejects a timid week that drops below what they just ran', () => {
    const timid = week('Establish a baseline', [[easy(8000)], [easy(6000)], [easy(7000)], [easy(8000)]])
    expect(() => validateDraftVolume(draft(timid), band, DAYS)).toThrow(/against a recent 45 km/)
  })

  it('allows a light week when the focus says why, exactly as reduced frequency is allowed', () => {
    const cutback = week('Planned cutback week to absorb the block.', [[easy(8000)], [easy(6000)], [easy(7000)], [easy(8000)]])
    expect(() => validateDraftVolume(draft(cutback), band, DAYS)).not.toThrow()
  })

  it('rejects a jump too big to absorb, even when both weeks are within capacity', () => {
    const first = week('Steady', [[easy(11000)], [easy(11000)], [easy(11000)], [easy(12000)]], '2026-09-28')
    const leap = week('Steady', [[easy(15000)], [easy(15000)], [easy(14000)], [easy(14000)]], '2026-10-05')
    expect(() => validateDraftVolume(draft(first, leap), band, DAYS)).toThrow(/jumps from/)
  })

  it('lets the week after a real cutback return to the level before it', () => {
    // 15-30% is what a cutback is worth taking; measured against the week just
    // gone, any of it would forbid resuming the build it was taken to serve.
    const build = week('Build', [[easy(12000)], [easy(12000)], [easy(12000)], [easy(14000)]], '2026-09-28')
    const cutback = week('Cutback week to absorb the build.', [[easy(9000)], [easy(9000)], [easy(9000)], [easy(11000)]], '2026-10-05')
    const rebuild = week('Resume the build', [[easy(12000)], [easy(12000)], [easy(13000)], [easy(14000)]], '2026-10-12')

    expect(weekKm(rebuild)).toBeGreaterThan(weekKm(cutback) * 1.12 + 2)
    expect(() => validateDraftVolume(draft(build, cutback, rebuild), band, DAYS)).not.toThrow()
  })

  it('still refuses a rebound that overshoots the level before the cutback', () => {
    const build = week('Build', [[easy(11000)], [easy(11000)], [easy(11000)], [easy(11000)]], '2026-09-28')
    const cutback = week('Cutback week to absorb the build.', [[easy(8000)], [easy(8000)], [easy(8000)], [easy(9000)]], '2026-10-05')
    const overshoot = week('Resume the build', [[easy(14000)], [easy(14000)], [easy(14000)], [easy(14000)]], '2026-10-12')

    expect(() => validateDraftVolume(draft(build, cutback, overshoot), band, DAYS)).toThrow(/jumps from/)
  })

  it('holds the first week to what the athlete has been running, not just to the ceiling', () => {
    // Adam ran 45 km last week. A block regenerating every month gets twelve
    // chances a year to open on a week nothing has checked.
    const opener = week('Straight back in', [[easy(15000)], [easy(15000)], [easy(15000)], [easy(13000)]], '2026-09-28')

    expect(weekKm(opener)).toBeLessThan(volumeBand(HISTORY).capacityKm * 1.05 + 3)
    expect(() => validateDraftVolume(draft(opener), band, DAYS)).toThrow(/jumps from 45 km to 58 km/)
  })

  it('refuses a long run beyond anything the athlete has recently run', () => {
    // A 60 km week is inside the ceiling and the 24 km hides in it. Adam's
    // longest training run is 16 km.
    const hidden = week('Build', [[easy(12000)], [easy(12000)], [easy(12000)], [easy(24000)]], '2026-09-28')

    expect(weekKm(hidden)).toBe(60)
    expect(() => validateDraftVolume(draft(hidden), band, DAYS))
      .toThrow(/24 km session but the longest run of the last months was 16 km/)
  })

  it('refuses a long run that swallows its week even when the distance is familiar', () => {
    // 16 km is well inside a half-marathoner's history, and still wrong here.
    const lopsided = week('Build', [[easy(9000)], [easy(9000)], [easy(9000)], [easy(16000)]], '2026-09-28')

    expect(() => validateDraftVolume(draft(lopsided), { ...band, longestRunKm: 30 }, DAYS))
      .toThrow(/over 30% of a full week/)
  })

  it('says nothing when there is no history to judge against', () => {
    const empty = { ...HISTORY, recent7DaysKm: 0, recentWeeklyAverageKm: 0, best4WeekAverageKm: 0 }
    const anything = week('Whatever', [[easy(30000)]])
    expect(() => validateDraftVolume(draft(anything), volumeBand(empty), DAYS)).not.toThrow()
  })
})

describe('a week measured in training days, not calendar days', () => {
  const band = volumeBand(HISTORY)

  it('judges a block starting mid-week when every training day still falls in it', () => {
    // Tue 22 to Sun 27 spans five calendar days but holds all five running days,
    // so it must carry a whole week - this is the 40.9 km week that slipped through.
    const tuesdayStart: BootstrapWeekDraft = {
      startDate: '2026-09-22', endDate: '2026-09-27', focus: 'Re-establishing consistency',
      workouts: [[easy(8000)], [easy(6000)], [easy(6900)], [easy(8000)], [easy(12000)]]
        .map((b, i) => ({ date: '2026-09-22', type: 'easy' as const, title: `w${i}`, description: '', blocks: b })),
    }
    expect(() => validateDraftVolume(draft(tuesdayStart), band, DAYS)).toThrow(/against a recent 45 km/)
  })

  it('pro-rates a week that genuinely loses training days', () => {
    // Fri to Sun holds only Saturday and Sunday: two of five days, so two fifths.
    const tail: BootstrapWeekDraft = {
      startDate: '2026-10-16', endDate: '2026-10-18', focus: 'Closing days',
      workouts: [[easy(8000)], [easy(10000)]]
        .map((b, i) => ({ date: '2026-10-17', type: 'easy' as const, title: `w${i}`, description: '', blocks: b })),
    }
    expect(() => validateDraftVolume(draft(tail), band, DAYS)).not.toThrow()
  })
})
