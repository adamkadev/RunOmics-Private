import 'server-only'
import { createHash } from 'crypto'
import type { GarminWorkoutPayload } from './garminWorkoutMapping'

export const GARMIN_SYNC_SCHEMA_VERSION = 1 as const

/**
 * scheduled: on the calendar; workout_created: in the library only; unverified: pushed but not where
 * Garmin was asked to put it. The ids stay in every case: they name what to clean up.
 */
export type GarminSyncEntryStatus = 'scheduled' | 'workout_created' | 'unverified'

const STATUSES: readonly GarminSyncEntryStatus[] = ['scheduled', 'workout_created', 'unverified']

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

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex').slice(0, 32)
}

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
  if (!entry.status || !STATUSES.includes(entry.status)) {
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
