import { stableHash } from './garminSyncState'
import type { IntervalsWorkoutEvent } from './intervalsWorkoutEncoding'

export const INTERVALS_SYNC_SCHEMA_VERSION = 1 as const

/** unverified: sent, but intervals.icu did not show it back on its date with its external id. */
export type IntervalsSyncEntryStatus = 'synced' | 'unverified'

const STATUSES: readonly IntervalsSyncEntryStatus[] = ['synced', 'unverified']

export interface IntervalsSyncEntry {
  prescriptionId: string
  date: string
  contentHash: string
  eventId: string
  externalId: string
  status: IntervalsSyncEntryStatus
  lastSyncedAt: string
}

export interface IntervalsSyncState {
  schemaVersion: typeof INTERVALS_SYNC_SCHEMA_VERSION
  athleteId: string | null
  planId: string | null
  updatedAt: string | null
  entries: IntervalsSyncEntry[]
}

export function emptyIntervalsSyncState(athleteId: string | null = null): IntervalsSyncState {
  return { schemaVersion: INTERVALS_SYNC_SCHEMA_VERSION, athleteId, planId: null, updatedAt: null, entries: [] }
}

export function intervalsContentHash(event: IntervalsWorkoutEvent): string {
  return stableHash({ event })
}

export function parseIntervalsSyncState(raw: unknown, source?: string): IntervalsSyncState {
  const label = source ? ` in ${source}` : ''
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid intervals.icu sync state${label}`)
  const value = raw as Partial<IntervalsSyncState>
  if (value.schemaVersion !== INTERVALS_SYNC_SCHEMA_VERSION) {
    throw new Error(`Unsupported intervals.icu sync schema version${label}: ${String(value.schemaVersion)}`)
  }
  if (!Array.isArray(value.entries)) throw new Error(`intervals.icu sync state${label} has no entries array`)
  return {
    schemaVersion: INTERVALS_SYNC_SCHEMA_VERSION,
    athleteId: value.athleteId ?? null,
    planId: value.planId ?? null,
    updatedAt: value.updatedAt ?? null,
    entries: value.entries.map((entry) => parseEntry(entry, label)),
  }
}

function parseEntry(raw: unknown, label: string): IntervalsSyncEntry {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid intervals.icu sync entry${label}`)
  const entry = raw as Partial<IntervalsSyncEntry>
  for (const key of ['prescriptionId', 'date', 'contentHash', 'eventId', 'externalId'] as const) {
    if (typeof entry[key] !== 'string' || !entry[key]) throw new Error(`intervals.icu sync entry${label} is missing ${key}`)
  }
  if (!entry.status || !STATUSES.includes(entry.status)) {
    throw new Error(`intervals.icu sync entry${label} has an unknown status: ${String(entry.status)}`)
  }
  return {
    prescriptionId: entry.prescriptionId as string,
    date: entry.date as string,
    contentHash: entry.contentHash as string,
    eventId: entry.eventId as string,
    externalId: entry.externalId as string,
    status: entry.status,
    lastSyncedAt: entry.lastSyncedAt ?? '',
  }
}
