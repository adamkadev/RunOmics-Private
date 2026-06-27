/** Rounds a number to a fixed number of decimal places (default 1). */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
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
