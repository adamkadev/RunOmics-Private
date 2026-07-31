import type { ActivityWeather } from './types'

export const HEAT_NEUTRAL_C = 15

// Apparent temperature already folds humidity, wind and radiation into a single
// heat-stress number, so it is the only input the cost needs. The slopes are the
// pace-adjustment tables distance coaching uses: ~0.5%/degC from 15 to 25 degC,
// ~1%/degC past 25. Cold carries a cost too, but small enough that modelling it
// would add noise rather than signal.
export function heatPenalty(apparentTempC: number): number {
  const overNeutral = apparentTempC - HEAT_NEUTRAL_C
  if (overNeutral <= 0) return 0
  return Math.min(overNeutral, 10) * 0.005 + Math.max(overNeutral - 10, 0) * 0.01
}

/** The efficiency factor the same run would have produced at HEAT_NEUTRAL_C. */
export function heatAdjustedEf(ef: number, weather: ActivityWeather | null): number {
  return weather ? ef * (1 + heatPenalty(weather.apparentTempC)) : ef
}
