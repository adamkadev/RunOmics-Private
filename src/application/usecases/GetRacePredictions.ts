import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getRecords, computeBestEfforts, EFFORTS } from './GetRecords'
import { getVO2maxHistory, type VO2maxPoint } from './GetVO2maxHistory'
import { riegel, bestSourceFromMap } from '@/domain/training/riegel'
import { addDays, isoDate } from '@/lib/calendarDate'

const PREDICTED_KEYS = ['5k', '10k', 'half', 'marathon'] as const
const KM_BY_KEY = Object.fromEntries(EFFORTS.map((e) => [e.key, e.km])) as Record<string, number>
const TREND_WEEKS = 12
const FORM_WINDOW_WEEKS = 8
// Only half of the VO2max change is reflected in the prediction - VO2max isn't perfectly linear with race time.
const FORM_DAMPING = 0.5
const RECENT_EFFORTS_COUNT = 5

export interface RacePrediction {
  key: string
  label: string
  km: number
  predictedSeconds: number
  lowSeconds: number
  highSeconds: number
  actualSeconds: number | null
  actualDate: string | null
  trendDeltaSeconds: number | null
  trendWeeks: number
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Individual recorded times for `key` (not just the best), most recent first. */
export function recentEffortTimes(activities: Activity[], key: string, n: number): number[] {
  return activities
    .filter((a) => a.bestEfforts?.[key] != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .map((a) => a.bestEfforts![key] as number)
}

/** +/- seconds around a prediction, from the coefficient of variation of recent same-distance efforts. */
export function confidenceBandSeconds(predictedSeconds: number, recentTimes: number[]): number {
  if (recentTimes.length < 2) return 0
  const mean = recentTimes.reduce((s, v) => s + v, 0) / recentTimes.length
  if (mean <= 0) return 0
  return Math.round(predictedSeconds * (stdev(recentTimes) / mean))
}

/**
 * Ratio of current VO2max to its value ~`windowWeeks` ago (1 = unchanged, >1 = improved).
 *
 * The reference point is found by date rather than by counting entries back:
 * the series is sampled monthly, and a sample is missing for any month with no
 * reading, so its index says nothing about how long ago it was.
 */
export function vo2maxFormFactor(history: VO2maxPoint[], windowWeeks: number): number {
  if (history.length < 2) return 1
  const latest = history[history.length - 1]
  if (!latest) return 1

  const cutoff = isoDate(addDays(new Date(latest.date + 'T00:00:00'), -windowWeeks * 7))
  const past = [...history].reverse().find((p) => p.date <= cutoff) ?? history[0]
  if (!past || past === latest || past.value <= 0) return 1
  return latest.value / past.value
}

/** Damps a Riegel prediction by recent VO2max trend - improving fitness predicts a faster time. */
export function applyFormWeighting(predictedSeconds: number, formFactor: number, damping = FORM_DAMPING): number {
  return Math.round(predictedSeconds * (1 - damping * (formFactor - 1)))
}

function rawPrediction(bestByKey: Map<string, number>, key: string, km: number): number | null {
  const source = bestSourceFromMap(bestByKey, key, KM_BY_KEY, km)
  return source ? riegel(source.seconds, source.sourceKm, km) : null
}

export async function getRacePredictions(): Promise<RacePrediction[]> {
  const activities = getAllActivities()
  const records = await getRecords()
  const recordByKey = new Map(records.filter((r) => r.seconds !== null).map((r) => [r.key, r.seconds as number]))

  const vo2history = getVO2maxHistory()
  const formFactor = vo2maxFormFactor(vo2history, FORM_WINDOW_WEEKS)

  const latestDate = activities[0]?.date
  const cutoffDate = latestDate ? isoDate(addDays(new Date(latestDate + 'T00:00:00'), -TREND_WEEKS * 7)) : null
  const pastActivities = cutoffDate ? activities.filter((a) => a.date <= cutoffDate) : []
  const pastBestByKey = new Map(
    Array.from(computeBestEfforts(pastActivities), ([key, entry]) => [key, entry.seconds] as const),
  )

  const results: RacePrediction[] = []

  for (const key of PREDICTED_KEYS) {
    const km = KM_BY_KEY[key]
    if (!km) continue

    const rawNow = rawPrediction(recordByKey, key, km)
    if (rawNow === null) continue

    const predictedSeconds = applyFormWeighting(rawNow, formFactor)
    const source = bestSourceFromMap(recordByKey, key, KM_BY_KEY, km)
    const recentTimes = source ? recentEffortTimes(activities, findRecordKeyForKm(source.sourceKm), RECENT_EFFORTS_COUNT) : []
    const band = confidenceBandSeconds(predictedSeconds, recentTimes)

    const rawThen = pastActivities.length ? rawPrediction(pastBestByKey, key, km) : null
    const trendDeltaSeconds = rawThen !== null ? rawNow - rawThen : null

    const record = records.find((r) => r.key === key)

    results.push({
      key,
      label: EFFORTS.find((e) => e.key === key)?.label ?? key,
      km,
      predictedSeconds,
      lowSeconds: predictedSeconds - band,
      highSeconds: predictedSeconds + band,
      actualSeconds: record?.seconds ?? null,
      actualDate: record?.date ?? null,
      trendDeltaSeconds,
      trendWeeks: TREND_WEEKS,
    })
  }

  return results
}

function findRecordKeyForKm(km: number): string {
  return EFFORTS.find((e) => e.km === km)?.key ?? ''
}
