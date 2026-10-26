import { getActivitiesWithEffectiveTypes } from '@/application/coaching/GetCoachingView'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import type { Activity } from '@/domain/activity/types'
import { round } from '@/lib/math'

export interface ShoeComparisonRow {
  gearId: string
  name: string
  brand: string
  dotColor: string
  retired: boolean
  sessionCount: number
  totalKm: number
  firstUsed: string
  lastUsed: string
  cadenceSpm: number | null
  groundContactMs: number | null
  verticalOscillationMm: number | null
  paceSecPerKm: number | null
  avgHeartRate: number | null
  keySessionPercent: number
}

const MIN_SESSIONS = 5

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

function buildRow(gearId: string, runs: Activity[]): ShoeComparisonRow | null {
  const registered = getShoeRegistry()[gearId]
  if (!registered || runs.length < MIN_SESSIONS) return null

  const cadence = mean(runs.map((a) => a.cadenceSpm))
  const groundContact = mean(runs.map((a) => a.groundContactMs))
  const oscillation = mean(runs.map((a) => a.verticalOscillationMm))
  const pace = mean(runs.map((a) => a.paceSecPerKm))
  const hr = mean(runs.map((a) => a.avgHeartRate))

  const dates = runs.map((a) => a.date.slice(0, 10))

  return {
    gearId,
    name: registered.name,
    brand: registered.brand,
    dotColor: registered.dotColor,
    retired: registered.retired,
    sessionCount: runs.length,
    totalKm: round(runs.reduce((sum, a) => sum + a.distanceKm, 0), 1),
    firstUsed: dates[dates.length - 1]!,
    lastUsed: dates[0]!,
    cadenceSpm: cadence == null ? null : round(cadence, 1),
    groundContactMs: groundContact == null ? null : Math.round(groundContact),
    verticalOscillationMm: oscillation == null ? null : round(oscillation, 1),
    paceSecPerKm: pace == null ? null : Math.round(pace),
    avgHeartRate: hr == null ? null : Math.round(hr),
    keySessionPercent: Math.round((runs.filter((a) => a.type !== 'Base').length / runs.length) * 100),
  }
}

export function getShoeComparison(): ShoeComparisonRow[] {
  const byGear = new Map<string, Activity[]>()
  for (const a of getActivitiesWithEffectiveTypes()) {
    if (!a.gearId) continue
    byGear.set(a.gearId, [...(byGear.get(a.gearId) ?? []), a])
  }

  return [...byGear.entries()]
    .map(([gearId, runs]) => buildRow(gearId, runs))
    .filter((row): row is ShoeComparisonRow => row !== null)
    .sort((a, b) => b.totalKm - a.totalKm)
}
