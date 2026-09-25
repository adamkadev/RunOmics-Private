import type { ActivityWeather } from './types'

export const HEAT_NEUTRAL_C = 15

export function heatPenalty(apparentTempC: number): number {
  const overNeutral = apparentTempC - HEAT_NEUTRAL_C
  if (overNeutral <= 0) return 0
  return Math.min(overNeutral, 10) * 0.005 + Math.max(overNeutral - 10, 0) * 0.01
}

/** Efficiency with the heat cost taken back out. A run without a usable
 *  temperature (no weather, or weather without apparentTempC) stays as
 *  measured - a missing temperature made the penalty, and the tooltip, NaN. */
export function heatAdjustedEf(ef: number, weather: ActivityWeather | null): number {
  const temp = weather?.apparentTempC
  return typeof temp === 'number' && Number.isFinite(temp) ? ef * (1 + heatPenalty(temp)) : ef
}
