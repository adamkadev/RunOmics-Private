import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import { isCheckInDate, readCheckIn, type CheckIn } from '@/domain/wellness/checkIn'

/** The nightly sync's copy of the Firestore check-ins; null when it has never written one. */
export function getWellnessBackup(): Map<string, CheckIn> | null {
  const file = readJsonFile<{ entries?: Record<string, unknown> } | null>(dataPath('wellness.json'), null)
  if (!file || typeof file.entries !== 'object' || file.entries === null) return null
  const entries = new Map<string, CheckIn>()
  for (const [date, raw] of Object.entries(file.entries)) {
    const entry = isCheckInDate(date) ? readCheckIn(raw) : null
    if (entry) entries.set(date, entry)
  }
  return entries
}
