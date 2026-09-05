import { createHash } from 'crypto'
import type { GarminWorkoutPayload } from './garminWorkoutMapping'

/**
 * Athlete-specific record of what RunOmics has put on Garmin. It is the only
 * thing that authorises a mutation: a Garmin workout absent from here was
 * created by someone else (by hand, by Garmin Suggested Workouts, by another
 * service) and is never touched.
 *
 * It holds Garmin ids for one athlete, so it lives in that athlete's private
 * data workspace (RUNOMICS_DATA_DIR), never in this repository.
 */

export const GARMIN_SYNC_SCHEMA_VERSION = 1 as const

/**
 * `scheduled` is the only complete state. `workout_created` records a create
 * that succeeded while its scheduling failed - it exists so the next run
 * retries the schedule against the workout already on Garmin instead of
 * creating a second copy of it.
 */
export type GarminSyncEntryStatus = 'scheduled' | 'workout_created'

export interface GarminSyncEntry {
  prescriptionId: string
  date: string
  contentHash: string
  garminWorkoutId: string
  garminWorkoutScheduleId: string | null
  status: GarminSyncEntryStatus
  lastSyncedAt: string
}

export interface GarminSyncState {
  schemaVersion: typeof GARMIN_SYNC_SCHEMA_VERSION
  planId: string | null
  updatedAt: string | null
  entries: GarminSyncEntry[]
}

export function emptyGarminSyncState(): GarminSyncState {
  return { schemaVersion: GARMIN_SYNC_SCHEMA_VERSION, planId: null, updatedAt: null, entries: [] }
}

/** Stable key ordering, so an unrelated re-serialisation never looks like a change. */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalise(nested)]),
    )
  }
  return value
}

/** Key-order-independent digest, so re-serialising an unchanged value is never a change. */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex').slice(0, 32)
}

/**
 * Identifies what was pushed to Garmin, not what the coach wrote: the hash
 * covers the Garmin payload and the scheduled date. A prescription edit that
 * changes neither (a provenance field, a revision bump) leaves Garmin alone.
 */
export function garminContentHash(payload: GarminWorkoutPayload, date: string): string {
  return stableHash({ payload, date })
}

export function parseGarminSyncState(raw: unknown, source?: string): GarminSyncState {
  const label = source ? ` in ${source}` : ''
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid Garmin sync state${label}`)
  const value = raw as Partial<GarminSyncState>
  if (value.schemaVersion !== GARMIN_SYNC_SCHEMA_VERSION) {
    throw new Error(`Unsupported Garmin sync schema version${label}: ${String(value.schemaVersion)}`)
  }
  if (!Array.isArray(value.entries)) throw new Error(`Garmin sync state${label} has no entries array`)
  return {
    schemaVersion: GARMIN_SYNC_SCHEMA_VERSION,
    planId: value.planId ?? null,
    updatedAt: value.updatedAt ?? null,
    entries: value.entries.map((entry) => parseEntry(entry, label)),
  }
}

function parseEntry(raw: unknown, label: string): GarminSyncEntry {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid Garmin sync entry${label}`)
  const entry = raw as Partial<GarminSyncEntry>
  for (const key of ['prescriptionId', 'date', 'contentHash', 'garminWorkoutId'] as const) {
    if (typeof entry[key] !== 'string' || !entry[key]) throw new Error(`Garmin sync entry${label} is missing ${key}`)
  }
  if (entry.status !== 'scheduled' && entry.status !== 'workout_created') {
    throw new Error(`Garmin sync entry${label} has an unknown status: ${String(entry.status)}`)
  }
  return {
    prescriptionId: entry.prescriptionId as string,
    date: entry.date as string,
    contentHash: entry.contentHash as string,
    garminWorkoutId: entry.garminWorkoutId as string,
    garminWorkoutScheduleId: entry.garminWorkoutScheduleId ?? null,
    status: entry.status,
    lastSyncedAt: entry.lastSyncedAt ?? '',
  }
}
