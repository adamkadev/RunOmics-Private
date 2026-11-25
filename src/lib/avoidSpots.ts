import { AVOID_LIMITS, AVOID_REASONS, type AvoidReason, type AvoidSpot } from '@/domain/explore/avoidSpots'

/** The generator no longer reads these; the sync still backs up the spots marked before. */
export const AVOID_SPOTS_COLLECTION = 'avoidSpots'

const isReason = (value: unknown): value is AvoidReason => AVOID_REASONS.includes(value as AvoidReason)

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A malformed document is left out of the backup rather than written as it is. */
export function readAvoidSpot(id: string, data: Record<string, unknown>): AvoidSpot | null {
  const { lon, lat, radiusM, createdAt, reason, expiresOn } = data
  if (typeof lon !== 'number' || typeof lat !== 'number' || typeof radiusM !== 'number' || typeof createdAt !== 'string') return null
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null
  if (radiusM < AVOID_LIMITS.minRadiusM || radiusM > AVOID_LIMITS.maxRadiusM) return null
  return {
    id,
    lon,
    lat,
    radiusM,
    createdAt,
    reason: isReason(reason) ? reason : null,
    expiresOn: typeof expiresOn === 'string' && DATE.test(expiresOn) ? expiresOn : null,
  }
}
