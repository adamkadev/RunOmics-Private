import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { RecoveryDay } from '@/domain/training/recovery'

export type { RecoveryDay }

// Files synced before HRV was dropped still carry an `hrv` field; it is ignored.
type Stored = { days?: Record<string, { restingHr?: number }> }

/** A resting heart rate a person can have: Garmin's daily value carries workout readings on some days. */
const RESTING_HR_BPM = { min: 30, max: 100 } as const

const restingHr = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= RESTING_HR_BPM.min && v <= RESTING_HR_BPM.max ? v : null

/** The synced days with a resting HR, oldest first; empty until the recovery sync has run. */
export function getRecoveryDays(): RecoveryDay[] {
  const stored = readJsonFile<Stored>(dataPath('recovery_history.json'), {})
  return Object.entries(stored.days ?? {})
    .flatMap(([date, day]) => {
      const bpm = restingHr(day?.restingHr)
      return bpm === null ? [] : [{ date, restingHr: bpm }]
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
