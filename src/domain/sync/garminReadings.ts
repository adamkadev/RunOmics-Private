import { DAY_MS } from '@/lib/calendarDate'
import { STALE_SYNC_HOURS } from './staleness'

/** Past these, a Garmin Connect reading is frozen: Connect's token expired, or the watch stopped sending it. */
export const GARMIN_READING_MAX_AGE_DAYS = {
  trainingStatus: STALE_SYNC_HOURS / 24,
  thresholdPace: 56,
  racePrediction: 14,
} as const

export type GarminReading = keyof typeof GARMIN_READING_MAX_AGE_DAYS

/** Whether a Garmin reading dated `date` (YYYY-MM-DD) can still stand for `today`; an undated one cannot. */
export function isCurrentGarminReading(reading: GarminReading, date: string | null | undefined, today: string): boolean {
  if (!date) return false
  const ageDays = (Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - Date.parse(`${date.slice(0, 10)}T00:00:00Z`)) / DAY_MS
  return Number.isFinite(ageDays) && ageDays <= GARMIN_READING_MAX_AGE_DAYS[reading]
}
