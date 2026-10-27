import { getShoeChoicesFromFirestore } from '@/infrastructure/repositories/FirestoreShoeChoiceRepository'

/** As Firestore stores them, so the restore script writes each document back as it was. */
export interface ShoeChoicesExport {
  runs: Record<string, { gearId: string }>
  settings: { default?: { gearId: string } }
}

/** Sorted by id, so the copy the sync commits changes only where a pick did. Null when Firestore did not answer. */
export async function exportShoeChoices(): Promise<ShoeChoicesExport | null> {
  const { runs, defaultGearId, available } = await getShoeChoicesFromFirestore()
  if (!available) return null
  const sorted = [...runs].sort(([a], [b]) => a.localeCompare(b)).map(([id, gearId]) => [id, { gearId }] as const)
  return { runs: Object.fromEntries(sorted), settings: defaultGearId ? { default: { gearId: defaultGearId } } : {} }
}
