import { getActivitiesWithEffectiveTypes } from '@/application/coaching/GetCoachingView'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import type { ActivityType } from '@/domain/activity/types'
import { kmPerWeek as computeKmPerWeek, wearPercent } from '@/domain/shoe/wearStatus'
import { round } from '@/lib/math'
import type { ShoeTypeBucket, ShoeDetail } from '@/domain/shoe/types'

export type { ShoeTypeBucket, ShoeDetail } from '@/domain/shoe/types'

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

// One bucket per zone colour the run dots wear, so the bar matches the dots.
function typeBucket(type: ActivityType): ShoeTypeBucket {
  if (type === 'Base') return 'base'
  if (type === 'Tempo') return 'tempo'
  if (type === 'Threshold') return 'threshold'
  return 'intervals'
}

export function getShoeDetail(gearId: string): ShoeDetail | null {
  const registered = getShoeRegistry()[gearId]
  if (!registered) return null

  const activities = getActivitiesWithEffectiveTypes()
    .filter((a) => a.gearId === gearId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalKm = round(activities.reduce((sum, a) => sum + a.distanceKm, 0), 1)
  const firstUsedDate = activities.at(-1)?.date ?? null
  const lastUsedDate = activities[0]?.date ?? null
  const kmPerWeek = Math.round(computeKmPerWeek(firstUsedDate, lastUsedDate, totalKm))

  const avgPaceSecPerKm = mean(activities.map((a) => a.paceSecPerKm))
  const avgHeartRate = mean(activities.map((a) => a.avgHeartRate))

  // By distance, not session count, so one long run outweighs two short ones.
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
