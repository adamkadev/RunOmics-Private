import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { RecoveryNight } from '@/domain/training/recovery'

export type { RecoveryNight }

type Stored = { days?: Record<string, { hrv?: number; restingHr?: number }> }

const value = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** A resting heart rate a person can have: Garmin's daily value carries workout readings on some days. */
const RESTING_HR_BPM = { min: 30, max: 100 } as const

const restingHr = (v: unknown): number | null => {
  const bpm = value(v)
  return bpm !== null && bpm >= RESTING_HR_BPM.min && bpm <= RESTING_HR_BPM.max ? bpm : null
}

/** The synced nights, oldest first; empty until the recovery sync has run. */
export function getRecoveryNights(): RecoveryNight[] {
  const stored = readJsonFile<Stored>(dataPath('recovery_history.json'), {})
  return Object.entries(stored.days ?? {})
    .map(([date, night]) => ({ date, hrv: value(night?.hrv), restingHr: restingHr(night?.restingHr) }))
    .filter((n) => n.hrv !== null || n.restingHr !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}
