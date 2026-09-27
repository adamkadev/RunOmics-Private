import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { RecoveryNight } from '@/domain/training/recovery'

export type { RecoveryNight }

type Stored = { days?: Record<string, { hrv?: number; restingHr?: number }> }

const value = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** The synced nights, oldest first; empty until the recovery sync has run. */
export function getRecoveryNights(): RecoveryNight[] {
  const stored = readJsonFile<Stored>(dataPath('recovery_history.json'), {})
  return Object.entries(stored.days ?? {})
    .map(([date, night]) => ({ date, hrv: value(night?.hrv), restingHr: value(night?.restingHr) }))
    .filter((n) => n.hrv !== null || n.restingHr !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}
