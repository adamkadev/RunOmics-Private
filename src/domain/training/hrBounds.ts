import { DEFAULT_HR_BOUNDS, type HrBounds } from './trimp'

/** Each missing value is defaulted on its own, so every screen scores TRIMP against the same bounds. */
export function hrBoundsFor(athlete: { maxHrBpm?: number; restingHrBpm?: number }): HrBounds {
  return {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }
}
