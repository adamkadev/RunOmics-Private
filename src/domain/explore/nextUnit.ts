import type { UnitCoverage } from './types'

/**
 * Distance counts against coverage, so a half-done quartier next door beats an
 * untouched one across the river. Quartiers go before communes: the card names a
 * "Next quartier", and a neighbouring village would otherwise win on distance
 * alone. Small or far units only come back when nothing else is left.
 */

/** A suggestion needs at least this many runnable cells. */
export const NEXT_MIN_CELLS = 5
/** ...and its label at most this far from home. */
export const NEXT_MAX_KM = 5
/** Kilometres that weigh as much as the whole 0–100% coverage range. */
export const NEXT_KM_PER_POINT = 6

/** `pct/100 + km/6` lands on 0.49999999999999994 for 0.5: a tie falls through to distance and name, not to rounding noise. */
const SCORE_EPSILON = 1e-9

/** Lower is better. With no home yet, a unit is scored on coverage alone. */
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

export function nextUnit(units: readonly UnitCoverage[]): UnitCoverage | null {
  const incomplete = units.filter((u) => u.state !== 'complete')
  const nearby = incomplete.filter(
    (u) => u.total >= NEXT_MIN_CELLS && u.distanceKm !== null && u.distanceKm <= NEXT_MAX_KM,
  )
  return best(nearby.filter((u) => u.kind === 'quartier')) ?? best(nearby) ?? best(incomplete)
}
