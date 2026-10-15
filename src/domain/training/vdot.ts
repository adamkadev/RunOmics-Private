/**
 * Daniels and Gilbert's oxygen-cost equations: the VDOT an effort implies,
 * and the threshold pace that VDOT implies in turn.
 */
function oxygenCost(metresPerMinute: number): number {
  return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute * metresPerMinute
}

export function vdotFromEffort(distanceKm: number, seconds: number): number {
  const velocity = (distanceKm * 1000) / (seconds / 60)
  const minutes = seconds / 60
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
  return oxygenCost(velocity) / percentMax
}

/** Daniels' T pace: the speed whose oxygen cost is 88% of VDOT, in seconds per km. */
export function thresholdPaceFromVdot(vdot: number): number {
  const cost = 0.88 * vdot
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - cost
  const metresPerMinute = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return Math.round(60_000 / metresPerMinute)
}
