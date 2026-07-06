// Simple deterministic heuristic (not physiological modeling): above a mild-weather
// baseline, every degree Celsius costs a small % of pace. Used only to annotate,
// never to alter, the displayed pace.
const HEAT_BASELINE_C = 15
const PERCENT_SLOWDOWN_PER_DEGREE = 0.005
const MIN_TEMPERATURE_FOR_ANNOTATION_C = 25

export function heatAdjustmentSecondsPerKm(paceSecPerKm: number, avgTemperatureC: number): number {
  const excess = Math.max(0, avgTemperatureC - HEAT_BASELINE_C)
  return Math.round(paceSecPerKm * PERCENT_SLOWDOWN_PER_DEGREE * excess)
}

export function shouldAnnotateHeat(avgTemperatureC: number | null | undefined): avgTemperatureC is number {
  return avgTemperatureC != null && avgTemperatureC >= MIN_TEMPERATURE_FOR_ANNOTATION_C
}
