import { DEFAULT_HR_BOUNDS, type HrBounds } from './trimp'

/**
 * The heart-rate bounds TRIMP is scored against, one way everywhere. Two
 * derivations coexisted: the training load (and the coach's CTL, which is
 * built to agree with it) filled each missing value from the defaults, while
 * /plan dropped to both defaults unless both values were known - so an athlete
 * with a max HR and no resting HR had a different weekly load on each screen.
 * What is known is used; only what is missing is defaulted.
 */
export function hrBoundsFor(athlete: { maxHrBpm?: number; restingHrBpm?: number }): HrBounds {
  return {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }
}
