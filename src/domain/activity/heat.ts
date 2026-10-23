import type { ActivityWeather } from './types'

export const HEAT_NEUTRAL_C = 15

export function heatPenalty(apparentTempC: number): number {
  const overNeutral = apparentTempC - HEAT_NEUTRAL_C
  if (overNeutral <= 0) return 0
  return Math.min(overNeutral, 10) * 0.005 + Math.max(overNeutral - 10, 0) * 0.01
}

export function heatAdjustedEf(ef: number, weather: ActivityWeather | null): number {
  const temp = weather?.apparentTempC
  return typeof temp === 'number' && Number.isFinite(temp) ? ef * (1 + heatPenalty(temp)) : ef
}
