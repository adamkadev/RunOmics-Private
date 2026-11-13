import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import { AXIS_TICK_DATE, formatDate } from '@/lib/formatters'
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
  paceGainSec: number | null
}

const MIN_POINTS = 2

export function getThresholdHistory(): ThresholdHistoryData | null {
  const entries = thresholdReadings()
  if (entries.length < MIN_POINTS) return null

  const points: ThresholdPoint[] = entries.map((entry) => ({
    date: entry.date,
    label: formatDate(entry.date, AXIS_TICK_DATE),
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

/**
 * Garmin's threshold detections, with the athlete history's daily copy filling the days between them: the one
 * source Analytics and the checkpoint both read, so the two never give the same pace two answers.
 */
export function thresholdReadings(): ThresholdSample[] {
  const byDate = new Map<string, ThresholdSample>()
  for (const { date, lthrBpm, thresholdPaceSecPerKm } of getAthleteHistory()) {
    if (lthrBpm !== undefined || thresholdPaceSecPerKm !== undefined) byDate.set(date, { date, lthrBpm, thresholdPaceSecPerKm })
  }
  for (const sample of getThresholdSamples()) byDate.set(sample.date, sample)
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}
