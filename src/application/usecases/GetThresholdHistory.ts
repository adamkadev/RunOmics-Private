import { t } from '@/i18n'
import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import {
  getThresholdSamples,
  type ThresholdSample,
} from '@/infrastructure/repositories/JsonThresholdHistoryRepository'

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
 * Lactate threshold over time, from Garmin's own biometric range endpoint (see
 * scripts/garmin/threshold_history.py). Falls back to the change log the
 * athlete sync snapshots, which is all there was before that endpoint was wired
 * up and covers nothing earlier.
 */
export function getThresholdHistory(): ThresholdHistoryData | null {
  const samples = getThresholdSamples()
  const entries: ThresholdSample[] = samples.length > 0 ? samples : athleteHistorySamples()
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

function athleteHistorySamples(): ThresholdSample[] {
  return getAthleteHistory()
    .filter((entry) => entry.lthrBpm !== undefined || entry.thresholdPaceSecPerKm !== undefined)
    .map(({ date, lthrBpm, thresholdPaceSecPerKm }) => ({ date, lthrBpm, thresholdPaceSecPerKm }))
}
