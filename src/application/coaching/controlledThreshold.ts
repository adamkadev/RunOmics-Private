/**
 * Coaching rules of thumb, not measured limits, kept together to be tuned; the planner is told
 * the dose limits as they stand. A controlled threshold repetition carries an hrBpm cap.
 */
export const CONTROLLED_THRESHOLD = {
  dose: {
    /** The most a week's controlled threshold time may grow over the loading week before it. */
    maxWeeklyStepMinutes: 15,
    /** Ceiling on controlled threshold time as a share of the week's running time; around 20% is the aim. */
    maxShareOfRunningTime: 0.25,
  },
  /** The shortest repetition of each class, in seconds: 8-10 minutes is long, 5-6 medium, shorter is short. */
  repClassMinSeconds: { long: 450, medium: 240 },
  autoregulation: {
    /** Where a repetition's heart rate should settle, per class. */
    targetHrBpm: { long: 169, medium: 171, short: 171 },
    ceilingHrBpm: 173,
    /** Heart rate lags, so a repetition is read from here to its end. */
    windowStartSeconds: 180,
    /** "Well under target": this far below it in every repetition. */
    wellUnderBpm: 5,
    /** A repetition counts as run at the guide within this of its range. */
    guideToleranceSecPerKm: 3,
    /** The size of a proposed pace-guide change. */
    paceStepSecPerKm: { min: 3, max: 5 },
    /** Consecutive sessions of one class that must agree before a change is proposed. */
    sessionsInARow: 2,
  },
  fatigue: {
    /** An easy run this far above the recent normal at similar pace and temperature is flagged. */
    hrAboveNormalBpm: 5,
    similarPaceSecPerKm: 10,
    similarTempC: 4,
    /** Duration within this fraction, so a long run is compared with long runs. */
    similarDurationShare: 0.3,
    lookbackDays: 42,
    minComparables: 3,
  },
  fitnessCheck: {
    /** A run this long, raced or prescribed as a race, is a 5K check. */
    distanceKm: { min: 4.9, max: 5.3 },
    /** How recent the check must be to propose anything from it. */
    withinDays: 42,
    /** The previous check must be this recent to set a proportion; an older one makes the new check a baseline. */
    previousWithinDays: 120,
  },
  lighterWeek: { thresholdCut: 1 / 3, easyCut: 0.2 },
} as const

export type RepLengthClass = 'long' | 'medium' | 'short'

export function repLengthClass(seconds: number): RepLengthClass {
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.long) return 'long'
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.medium) return 'medium'
  return 'short'
}
