import type { NumberRange } from '@/domain/coaching/types'

/** Coaching rules of thumb, not measured limits, kept together to be tuned; the planner is told them as they stand. */
export const CONTROLLED_THRESHOLD = {
  dose: {
    /** The most a week's controlled threshold time may grow over the loading week before it. */
    maxWeeklyStepMinutes: 15,
    /** Ceiling on controlled threshold time as a share of the week's running time; around 20% is the aim. */
    maxShareOfRunningTime: 0.25,
  },
  /** The week the dose stops growing at: two sessions, in about the volume sustained over four weeks. */
  fullWeek: { sessions: 2, sessionMinutes: 30, kmEitherSide: 1 },
  /** A general block is three rising weeks and a lighter fourth; how fast they rise follows the athlete's signals. */
  block: {
    weeklyRise: { green: 0.05, yellow: 0.02 },
    /** A block run for less than this was replaced, not completed. */
    minBlockDays: 21,
    /** This many days without a run is a gap. */
    gapDays: 7,
    /** A week holds the dose at this share of it, so a rounded repetition still reaches it. */
    fullDoseShare: 0.9,
    /** An easy run this far above the recent normal is yellow; fatigue.hrAboveNormalBpm is red. */
    easyHrAboveNormalBpm: 3,
    poorCheckIns: { lookbackDays: 14, count: 3, worstScore: 2 },
    niggle: { lookbackDays: 28, daysReported: 3, pain: 4 },
    /** A week matches its target within this, a partial one too: rounding its sessions is the same job. */
    targetToleranceKm: 1,
  },
  /** Short repetitions are guided in the band of this width that holds threshold pace. */
  shortGuideBandSecPerKm: 5,
  /** The shortest repetition of each class, in seconds: 8-10 minutes is long, 5-6 medium, shorter is short. */
  repClassMinSeconds: { long: 450, medium: 240 },
  heartRate: {
    /** A repetition's ceiling sits this far under the athlete's LTHR, which keeps it sub-threshold. */
    ceilingBelowLthrBpm: 6,
    /** Where a repetition's heart rate should settle, this far under the ceiling, per class. */
    targetBelowCeilingBpm: { long: 4, medium: 2, short: 2 },
  },
  autoregulation: {
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
    /** Raw pace here reads ~8 s/km slower than grade-adjusted, most of similarPaceSecPerKm: it says little of effort. */
    hillyClimbMPerKm: 15,
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

export interface ControlledThresholdHr {
  ceilingBpm: number
  targetBpm: Record<RepLengthClass, number>
}

/** A session is judged against the ceiling it prescribed, which is what the watch held the athlete to. */
export function heartRateUnder(ceilingBpm: number): ControlledThresholdHr {
  const below = CONTROLLED_THRESHOLD.heartRate.targetBelowCeilingBpm
  return {
    ceilingBpm,
    targetBpm: { long: ceilingBpm - below.long, medium: ceilingBpm - below.medium, short: ceilingBpm - below.short },
  }
}

/** Null without an LTHR: a %HRmax zone floor is no threshold, so no ceiling is guessed from one. */
export function controlledThresholdHr(lthrBpm: number | null | undefined): (ControlledThresholdHr & { lthrBpm: number }) | null {
  if (!lthrBpm) return null
  return { lthrBpm, ...heartRateUnder(lthrBpm - CONTROLLED_THRESHOLD.heartRate.ceilingBelowLthrBpm) }
}

export function repLengthClass(seconds: number): RepLengthClass {
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.long) return 'long'
  if (seconds >= CONTROLLED_THRESHOLD.repClassMinSeconds.medium) return 'medium'
  return 'short'
}

export type BlockSignal = 'green' | 'yellow' | 'red'

/** Whole weeks: three rising and a lighter fourth. A partial week takes its share of the week it starts. */
export interface BlockTargets {
  signal: BlockSignal
  /** What set the colour, in plain words for the plan focus. */
  reasons: string[]
  weeklyRisePct: number
  /** Week 1 of the block being renewed, or null when no earlier block held the full dose. */
  previousWeek1Km: number | null
  weekKmTargets: number[]
  /** The bounds that held a target down, empty when none did. */
  heldBy: string[]
}

export interface ControlledThresholdFacts {
  heartRate: ControlledThresholdHr & { lthrBpm: number }
  fullWeek: { sessions: number; minutesPerSession: number; weekKm: NumberRange | null }
  /** For a general block; absent while returning, when the return rules set every week. */
  block?: BlockTargets
  shortRepetitionGuideSecPerKm: NumberRange | null
}

/** This athlete's numbers for the planner, from their own data, so no athlete's prompt carries another's. */
export function controlledThresholdFacts(
  lthrBpm: number | null | undefined,
  thresholdPaceSecPerKm: number | null | undefined,
  best4WeekAverageKm: number,
  block?: BlockTargets,
): ControlledThresholdFacts | null {
  const heartRate = controlledThresholdHr(lthrBpm)
  if (!heartRate) return null
  const { fullWeek, shortGuideBandSecPerKm: band } = CONTROLLED_THRESHOLD
  const km = Math.round(best4WeekAverageKm)
  const loading = block?.weekKmTargets.slice(0, 3)
  const fastest = thresholdPaceSecPerKm ? Math.floor(thresholdPaceSecPerKm / band) * band : null
  return {
    heartRate,
    fullWeek: {
      sessions: fullWeek.sessions,
      minutesPerSession: fullWeek.sessionMinutes,
      weekKm: loading
        ? { min: Math.min(...loading), max: Math.max(...loading) }
        : km > fullWeek.kmEitherSide ? { min: km - fullWeek.kmEitherSide, max: km + fullWeek.kmEitherSide } : null,
    },
    ...(block ? { block } : {}),
    shortRepetitionGuideSecPerKm: fastest === null ? null : { min: fastest, max: fastest + band },
  }
}
