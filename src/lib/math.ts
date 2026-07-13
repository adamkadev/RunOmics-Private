/** Rounds a number to a fixed number of decimal places (default 1). */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat1 - lat2) * 111.32
  const dLon = (lon1 - lon2) * 111.32 * Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export interface LinearRegression {
  slope: number
  intercept: number
}

/** Ordinary least-squares fit. Returns null below 5 points or with no x variance. */
export function linearRegression(pts: { x: number; y: number }[]): LinearRegression | null {
  const n = pts.length
  if (n < 5) return null
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n
  const ssXX = pts.reduce((s, p) => s + (p.x - meanX) ** 2, 0)
  const ssXY = pts.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0)
  if (ssXX === 0) return null
  return { slope: ssXY / ssXX, intercept: meanY - (ssXY / ssXX) * meanX }
}
