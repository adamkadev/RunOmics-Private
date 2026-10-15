/**
 * The controlled threshold numbers in one place. A controlled threshold
 * session is a threshold workout whose repetitions carry an hrBpm cap, run
 * by pace with heart rate as the limit, so it stays below the threshold. Every figure here is a coaching rule of
 * thumb, not a measured limit, so they are kept together to be tuned: the
 * validators and the autoregulation read them, and the planner is told the
 * dose limits as they stand.
 */
export const CONTROLLED_THRESHOLD = {
  dose: {
    /** The most a week's controlled threshold time may grow over the loading week before it. */
    maxWeeklyStepMinutes: 15,
    /** Ceiling on controlled threshold time as a share of the week's running time; around 20% is the aim. */
    maxShareOfRunningTime: 0.25,
  },
  /**
   * Repetition length classes, by the shortest length in each, in seconds:
   * 8-10 minute repetitions are long, 5-6 medium, anything shorter short.
   * Pace guides and heart-rate targets are set per class, slower for longer.
   */
  repClassMinSeconds: { long: 450, medium: 240 },
  autoregulation: {
    /** Where a repetition's heart rate should settle, per class. */
    targetHrBpm: { long: 169, medium: 171, short: 171 },
    /** The hard ceiling for every class. */
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
    /**
     * The check it is compared with, to move the guides in proportion: the one
     * before it in the 8-12 week rhythm. An older one, run in another season
     * of fitness, sets no proportion, and the new check is a baseline.
     */
    previousWithinDays: 120,
  },
  /** A lighter week: controlled threshold time cut by about a third, easy running by about a fifth. */
  lighterWeek: { thresholdCut: 1 / 3, easyCut: 0.2 },
} as const

export type RepLengthClass = 'long' | 'medium' | 'short'

export function repLengthClass(seconds: number): RepLengthClass {
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.long) return 'long'
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.medium) return 'medium'
  return 'short'
}
