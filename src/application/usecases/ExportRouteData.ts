import type { AvoidSpot } from '@/domain/explore/avoidSpots'
import { getRouteData } from '@/infrastructure/repositories/FirestoreRouteDataRepository'

/** As stored in Firestore, so the restore script writes each document back as it was. */
export type AvoidSpotDoc = Omit<AvoidSpot, 'id' | 'reason' | 'expiresOn'> & {
  reason?: NonNullable<AvoidSpot['reason']>
  expiresOn?: string
}

export interface RouteDataExport {
  names: Record<string, { name: string }>
  spots: Record<string, AvoidSpotDoc>
}

/** Sorted by id, so the copies the sync commits change only where a name or a spot did. Null when Firestore did not answer. */
export async function exportRouteData(): Promise<RouteDataExport | null> {
  const { routeNames, avoidSpots, available } = await getRouteData()
  if (!available) return null
  const names = [...routeNames].sort(([a], [b]) => a.localeCompare(b)).map(([key, name]) => [key, { name }] as const)
  const spots = [...avoidSpots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, reason, expiresOn, ...spot }) => [id, { ...spot, ...(reason ? { reason } : {}), ...(expiresOn ? { expiresOn } : {}) }] as const)
  return { names: Object.fromEntries(names), spots: Object.fromEntries(spots) }
}
