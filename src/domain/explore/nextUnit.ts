import type { UnitCoverage } from './types'

/**
 * Nearest first, so the quartiers next to home are finished before the next ring out: a half-done one farther away
 * waits behind an untouched one nearer. Quartiers go before communes: the card names a "Next quartier".
 */

/** A suggestion needs at least this many runnable cells. */
export const NEXT_MIN_CELLS = 5
/** ...and its label at most this far from home. */
export const NEXT_MAX_KM = 5
/** Labels this close are the same distance from home, and the more explored goes first. */
export const NEXT_SAME_KM = 0.1

function compare(a: UnitCoverage, b: UnitCoverage): number {
  const da = a.distanceKm ?? Infinity
  const db = b.distanceKm ?? Infinity
  if (Math.abs(da - db) > NEXT_SAME_KM) return da < db ? -1 : 1
  if (a.pct !== b.pct) return b.pct - a.pct
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
