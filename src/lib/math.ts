/** Rounds a number to a fixed number of decimal places (default 1). */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
