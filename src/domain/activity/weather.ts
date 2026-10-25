export type CompassPoint = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const COMPASS_POINTS: CompassPoint[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function compassPoint(degrees: number): CompassPoint {
  const normalized = ((degrees % 360) + 360) % 360
  return COMPASS_POINTS[Math.round(normalized / 45) % 8] ?? 'n'
}

export type SkyCondition =
  | 'clear'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezingDrizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'showers'
  | 'snowShowers'
  | 'thunderstorm'

const WMO: [codes: number[], condition: SkyCondition][] = [
  [[0], 'clear'],
  [[1], 'mainlyClear'],
  [[2], 'partlyCloudy'],
  [[3], 'overcast'],
  [[45, 48], 'fog'],
  [[51, 53, 55], 'drizzle'],
  [[56, 57], 'freezingDrizzle'],
  [[61, 63, 65], 'rain'],
  [[66, 67], 'freezingRain'],
  [[71, 73, 75, 77], 'snow'],
  [[80, 81, 82], 'showers'],
  [[85, 86], 'snowShowers'],
  [[95, 96, 99], 'thunderstorm'],
]

/** The sky from Open-Meteo's WMO weather code; null for a code outside the table. */
export function skyCondition(code: number): SkyCondition | null {
  return WMO.find(([codes]) => codes.includes(code))?.[1] ?? null
}

/** Magnus formula: the dew point, not the humidity, says how muggy the air feels, whatever its temperature. */
export function dewPointC(tempC: number, humidityPct: number): number {
  const a = 17.62
  const b = 243.12
  const gamma = Math.log(Math.max(1, humidityPct) / 100) + (a * tempC) / (b + tempC)
  return (b * gamma) / (a - gamma)
}
