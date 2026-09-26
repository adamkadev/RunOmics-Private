import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import type { ActivityType } from '@/domain/activity/types'
import { kmPerWeek as computeKmPerWeek, wearPercent } from '@/domain/shoe/wearStatus'
import { round } from '@/lib/math'
import type { ShoeTypeBucket, ShoeDetail } from '@/domain/shoe/types'

// Moved to the domain; re-exported so every existing importer keeps working.
export type { ShoeTypeBucket, ShoeDetail } from '@/domain/shoe/types'

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

// One bucket per session zone, the colours the run dots wear (v4.4.1): Base
// Z2, Tempo Z3, Threshold Z4, and everything harder (Sprint, Anaerobic,
// VO2Max) or a Race Z5 as "intervals". Tempo and Threshold shared a bucket,
// so a list of green Z3 dots sat under a bar with no green in it.
function typeBucket(type: ActivityType): ShoeTypeBucket {
  if (type === 'Base') return 'base'
  if (type === 'Tempo') return 'tempo'
  if (type === 'Threshold') return 'threshold'
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
  const bucketDistance: Record<ShoeTypeBucket, number> = { base: 0, tempo: 0, threshold: 0, intervals: 0 }
  for (const a of activities) bucketDistance[typeBucket(a.type)] += a.distanceKm
  const share = (bucket: ShoeTypeBucket) => (totalKm === 0 ? 0 : Math.round((bucketDistance[bucket] / totalKm) * 100))
  const typeShare: Record<ShoeTypeBucket, number> = {
    base: share('base'),
    tempo: share('tempo'),
    threshold: share('threshold'),
    intervals: share('intervals'),
  }

  return {
    gearId,
    name: registered.name,
    brand: registered.brand,
    maxKm: registered.maxKm,
    alertThresholdKm: registered.alertThresholdKm,
    retired: registered.retired,
    totalKm,
    wearPercent: wearPercent({ totalKm, maxKm: registered.maxKm, retired: registered.retired }),
    firstUsedDate,
    kmPerWeek,
    avgPaceSecPerKm: avgPaceSecPerKm == null ? null : Math.round(avgPaceSecPerKm),
    avgHeartRate: avgHeartRate == null ? null : Math.round(avgHeartRate),
    typeShare,
    activities,
  }
}
