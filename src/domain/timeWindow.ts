export type ChartRange = '4w' | '6m' | '1y'

export const CHART_RANGES: ChartRange[] = ['4w', '6m', '1y']

export const RANGE_DAYS: Record<ChartRange, number> = {
  '4w': 28,
  '6m': 183,
  '1y': 365,
}

export interface WindowBounds {
  from: string
  to: string
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


export function windowBounds(range: ChartRange, offset: number, anchor: Date): WindowBounds {
  const days = RANGE_DAYS[range]
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  end.setDate(end.getDate() - offset * days)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  return { from: isoDate(start), to: isoDate(end) }
}

export function pointsInWindow<T extends { date: string }>(points: T[], bounds: WindowBounds): T[] {
  return points.filter((p) => p.date >= bounds.from && p.date <= bounds.to)
}

export function hasEarlierPoints(points: { date: string }[], bounds: WindowBounds): boolean {
  return points.some((p) => p.date < bounds.from)
}
