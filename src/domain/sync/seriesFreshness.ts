import { DAY_MS } from '@/lib/calendarDate'

/** The series the sync dates in sync_meta.json, as scripts/garmin/series_freshness.py names them. */
export const GARMIN_SERIES = ['trainingStatus', 'loadBalance', 'restingHr', 'racePredictions', 'vo2max', 'fitnessAge', 'threshold'] as const

export type GarminSeries = (typeof GARMIN_SERIES)[number]

/** Days without a new sample before a series counts as stopped; null for one Garmin moves only when the athlete does. */
export const STALE_AFTER_DAYS: Record<GarminSeries, number | null> = {
  trainingStatus: 3,
  loadBalance: 3,
  restingHr: 3,
  racePredictions: 14,
  vo2max: 21,
  fitnessAge: 21,
  threshold: null,
}

export interface SeriesFreshness {
  series: GarminSeries
  /** The newest sample's date; null for a series this watch or account has never filled. */
  newest: string | null
  ageDays: number | null
  stale: boolean
}

export function seriesFreshness(newest: Partial<Record<GarminSeries, string | null>>, now: number): SeriesFreshness[] {
  return GARMIN_SERIES.map((series) => {
    const date = newest[series] ?? null
    const ageDays = date ? Math.floor((now - Date.parse(`${date}T00:00:00Z`)) / DAY_MS) : null
    const limit = STALE_AFTER_DAYS[series]
    return { series, newest: date, ageDays, stale: ageDays !== null && limit !== null && ageDays > limit }
  })
}
