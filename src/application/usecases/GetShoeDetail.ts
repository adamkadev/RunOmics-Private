import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { kmPerWeek as computeKmPerWeek } from '@/domain/shoe/wearStatus'
import { round } from '@/lib/math'

export type ShoeTypeBucket = 'base' | 'tempo' | 'intervals'

export interface ShoeDetail {
  gearId: string
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  totalKm: number
  wearPercent: number
  firstUsedDate: string | null
  kmPerWeek: number
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  typeShare: Record<ShoeTypeBucket, number>
  activities: Activity[]
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

// Tempo and Threshold are both sustained-effort sessions, and everything
// harder than that (Sprint, Anaerobic, VO2Max) or a Race shares the
// "intervals" bucket - the three-way split the shoe page's usage bar draws,
// not the seven-way split ActivityType actually has.
function typeBucket(type: ActivityType): ShoeTypeBucket {
  if (type === 'Base') return 'base'
  if (type === 'Tempo' || type === 'Threshold') return 'tempo'
  return 'intervals'
}

export function getShoeDetail(gearId: string): ShoeDetail | null {
  const registered = getShoeRegistry()[gearId]
  if (!registered) return null

  const activities = getAllActivities()
    .filter((a) => a.gearId === gearId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalKm = round(activities.reduce((sum, a) => sum + a.distanceKm, 0), 1)
  const firstUsedDate = activities.at(-1)?.date ?? null
  const lastUsedDate = activities[0]?.date ?? null
  const kmPerWeek = Math.round(computeKmPerWeek(firstUsedDate, lastUsedDate, totalKm))

  const avgPaceSecPerKm = mean(activities.map((a) => a.paceSecPerKm))
  const avgHeartRate = mean(activities.map((a) => a.avgHeartRate))

  // By distance, not session count: the bar and the "more than half its X was
  // tempo" sentence both read as a share of the miles actually run in this
  // pair, matching how the rest of the app (TypeDistribution) already splits
  // a type mix - a count basis would let three short strides sessions and one
  // 30 km long run count the same.
  const bucketDistance = { base: 0, tempo: 0, intervals: 0 }
  for (const a of activities) bucketDistance[typeBucket(a.type)] += a.distanceKm
  const typeShare =
    totalKm === 0
      ? { base: 0, tempo: 0, intervals: 0 }
      : {
          base: Math.round((bucketDistance.base / totalKm) * 100),
          tempo: Math.round((bucketDistance.tempo / totalKm) * 100),
          intervals: Math.round((bucketDistance.intervals / totalKm) * 100),
        }

  return {
    gearId,
    name: registered.name,
    brand: registered.brand,
    maxKm: registered.maxKm,
    alertThresholdKm: registered.alertThresholdKm,
    retired: registered.retired,
    totalKm,
    wearPercent: registered.retired ? 100 : Math.min(100, round((totalKm / registered.maxKm) * 100, 0)),
    firstUsedDate,
    kmPerWeek,
    avgPaceSecPerKm: avgPaceSecPerKm == null ? null : Math.round(avgPaceSecPerKm),
    avgHeartRate: avgHeartRate == null ? null : Math.round(avgHeartRate),
    typeShare,
    activities,
  }
}
