import type { UnitCoverage } from './types'

/**
 * The "Next quartier": the one unit worth suggesting for the next run.
 *
 * Least explored wins, but distance counts against it: 6 km away costs as
 * much as 100 points of coverage, so a half-done quartier next door beats an
 * untouched one across the river. Units under 5 cells are too small to be a
 * goal of their own, and anything beyond 5 km is a trip rather than a run
 * from the door; both only come back when nothing else is left.
 *
 * Quartiers go before whole communes: the card names a "Next quartier", and
 * the communes around the city are there for context. A neighbouring village
 * on a wooded hillside would otherwise win on distance alone. A commune is
 * suggested only when no quartier is a candidate.
 */

/** A suggestion needs at least this many runnable cells. */
export const NEXT_MIN_CELLS = 5
/** ...and its label at most this far from home. */
export const NEXT_MAX_KM = 5
/** Kilometres that weigh as much as the whole 0–100% coverage range. */
export const NEXT_KM_PER_POINT = 6

/**
 * Two scores closer than this are a tie. `pct/100 + km/6` lands on values
 * like 0.49999999999999994 for what is arithmetically 0.5, and a tie should
 * fall through to distance and name, not to rounding noise.
 */
const SCORE_EPSILON = 1e-9

/**
 * Lower is better. A unit with no known distance (no home yet) is scored on
 * coverage alone; it only ever competes in the fallback, where every unit is
 * in the same position.
 */
export function nextUnitScore(unit: Pick<UnitCoverage, 'pct' | 'distanceKm'>): number {
  return unit.pct / 100 + (unit.distanceKm ?? 0) / NEXT_KM_PER_POINT
}

function compare(a: UnitCoverage, b: UnitCoverage): number {
  const byScore = nextUnitScore(a) - nextUnitScore(b)
  if (Math.abs(byScore) > SCORE_EPSILON) return byScore
  const da = a.distanceKm ?? Infinity
  const db = b.distanceKm ?? Infinity
  if (da !== db) return da < db ? -1 : 1
  // Code-point order, not localeCompare: the same answer on every device.
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function best(units: UnitCoverage[]): UnitCoverage | null {
  let winner: UnitCoverage | null = null
  for (const unit of units) {
    if (!winner || compare(unit, winner) < 0) winner = unit
  }
  return winner
}

/** The suggested unit, or null when every unit is complete. */
export function nextUnit(units: readonly UnitCoverage[]): UnitCoverage | null {
  const incomplete = units.filter((u) => u.state !== 'complete')
  const nearby = incomplete.filter(
    (u) => u.total >= NEXT_MIN_CELLS && u.distanceKm !== null && u.distanceKm <= NEXT_MAX_KM,
  )
  return best(nearby.filter((u) => u.kind === 'quartier')) ?? best(nearby) ?? best(incomplete)
}
