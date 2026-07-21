import { t } from '@/i18n'
import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'

export interface ThresholdPoint {
  date: string
  label: string
  lthrBpm: number | null
  thresholdPaceSecPerKm: number | null
}

export interface ThresholdHistoryData {
  points: ThresholdPoint[]
  latestLthr: number | null
  latestPace: number | null
  /** Seconds per km shaved off threshold pace across the window; negative = slower. */
  paceGainSec: number | null
}

const MIN_POINTS = 2

/**
 * Lactate threshold over time.
 *
 * Garmin only exposes the current value, so this reads the snapshots the sync
 * records whenever the number moves (see scripts/garmin/athlete.py). The series
 * therefore starts at the first sync after this was added and thickens from
 * there - it is not backfillable.
 */
export function getThresholdHistory(): ThresholdHistoryData | null {
  const entries = getAthleteHistory().filter(
    (entry) => entry.lthrBpm !== undefined || entry.thresholdPaceSecPerKm !== undefined,
  )
  if (entries.length < MIN_POINTS) return null

  const points: ThresholdPoint[] = entries.map((entry) => ({
    date: entry.date,
    label: new Date(entry.date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
    lthrBpm: entry.lthrBpm ?? null,
    thresholdPaceSecPerKm: entry.thresholdPaceSecPerKm ?? null,
  }))

  const paces = points.map((p) => p.thresholdPaceSecPerKm).filter((v): v is number => v !== null)
  const firstPace = paces[0]
  const lastPace = paces[paces.length - 1]
  const lthrs = points.map((p) => p.lthrBpm).filter((v): v is number => v !== null)

  return {
    points,
    latestLthr: lthrs[lthrs.length - 1] ?? null,
    latestPace: lastPace ?? null,
    paceGainSec:
      firstPace !== undefined && lastPace !== undefined && paces.length >= MIN_POINTS
        ? firstPace - lastPace
        : null,
  }
}
