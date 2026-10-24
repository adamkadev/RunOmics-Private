const DAY_MS = 86_400_000

export interface PredictionPoint {
  date: string
  seconds: number
}

/** Every 5 km on a half or longer, every km below it; a split within 500 m of the line would read as the finish. */
export function pacingCheckpoints(distanceKm: number): number[] {
  const step = distanceKm > 10 ? 5 : 1
  const marks: number[] = []
  for (let km = step; km < distanceKm - 0.5; km += step) marks.push(km)
  return [...marks, distanceKm]
}

export function evenSplit(totalSeconds: number, distanceKm: number, atKm: number): number {
  return Math.round((totalSeconds * atKm) / distanceKm)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function predictionChange(points: readonly PredictionPoint[], days: number): { seconds: number; perWeek: number } | null {
  const latest = points.at(-1)
  if (!latest) return null
  const from = points.find((p) => daysBetween(p.date, latest.date) <= days)
  if (!from || from === latest) return null
  const weeks = daysBetween(from.date, latest.date) / 7
  const seconds = latest.seconds - from.seconds
  return { seconds, perWeek: weeks > 0 ? seconds / weeks : 0 }
}

/** Under a week out there is no training left to close a gap with. */
export function perWeekToClose(gapSeconds: number, daysUntil: number): number | null {
  if (gapSeconds <= 0 || daysUntil < 7) return null
  return Math.ceil(gapSeconds / (daysUntil / 7))
}
