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

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** Over the weeks printed, as closingPace: a sparse history spans less than the window, and the rate must add up. */
export function predictionChange(points: readonly PredictionPoint[], days: number): { seconds: number; perWeek: number; weeks: number } | null {
  const latest = points.at(-1)
  if (!latest) return null
  const from = points.find((p) => daysBetween(p.date, latest.date) <= days)
  if (!from || from === latest) return null
  const weeks = Math.max(1, Math.round(daysBetween(from.date, latest.date) / 7))
  const seconds = latest.seconds - from.seconds
  return { seconds, perWeek: seconds / weeks, weeks }
}

/** The weeks printed are the weeks divided by, so rate × weeks covers the gap; under half a week there is none left. */
export function closingPace(gapSeconds: number, daysUntil: number): { perWeek: number; weeks: number } | null {
  const weeks = Math.round(daysUntil / 7)
  if (gapSeconds <= 0 || weeks < 1) return null
  return { perWeek: Math.ceil(gapSeconds / weeks), weeks }
}
