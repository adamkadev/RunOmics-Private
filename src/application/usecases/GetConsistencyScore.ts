import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'

export type ConsistencyRating = 'excellent' | 'good' | 'fair' | 'low'

export interface ConsistencyScore {
  score: number
  adherence: number       // % of weeks with at least 1 run
  stability: number       // 0-100, higher = more consistent weekly km
  rating: ConsistencyRating
  window: number          // weeks analyzed
}

const WINDOW_WEEKS = 12
const DAY_MS = 86_400_000

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
}

export function rating(score: number): ConsistencyRating {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 55) return 'fair'
  return 'low'
}

export function getConsistencyScore(): ConsistencyScore | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const nowMs = now.getTime()

  const weeklyKm: number[] = []
  let activeWeeks = 0

  for (let w = 0; w < WINDOW_WEEKS; w++) {
    const weekEndMs = nowMs - w * 7 * DAY_MS
    const weekStartMs = weekEndMs - 6 * DAY_MS
    const km = activities
      .filter((a) => {
        const d = new Date(a.date + 'T00:00:00').getTime()
        return d >= weekStartMs && d <= weekEndMs
      })
      .reduce((s, a) => s + a.distanceKm, 0)
    weeklyKm.push(km)
    if (km > 0) activeWeeks++
  }

  const adherence = round((activeWeeks / WINDOW_WEEKS) * 100)

  const mean = weeklyKm.reduce((s, v) => s + v, 0) / WINDOW_WEEKS
  const cv = mean > 0 ? Math.min(stdDev(weeklyKm) / mean, 1) : 1
  const stability = round((1 - cv) * 100)

  const score = round(adherence * 0.6 + stability * 0.4)

  return { score, adherence, stability, rating: rating(score), window: WINDOW_WEEKS }
}
