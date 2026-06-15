export type TrendDirection = 'up' | 'down' | 'flat'

export interface SeriesTrend {
  direction: TrendDirection
  delta: number
}

export function trendFromSeries(
  values: (number | null)[],
  flatThreshold: number,
): SeriesTrend | null {
  const data = values.filter((v): v is number => v !== null)
  if (data.length < 4) return null

  const mid = Math.floor(data.length / 2)
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const delta = avg(data.slice(mid)) - avg(data.slice(0, mid))

  return {
    direction: delta > flatThreshold ? 'up' : delta < -flatThreshold ? 'down' : 'flat',
    delta,
  }
}
