import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import { NO_SHOE_CHOICES, type ShoeChoices } from '@/domain/shoe/shoeChoice'

const gearIdOf = (doc: unknown) => {
  const gearId = (doc as { gearId?: unknown } | null)?.gearId
  return typeof gearId === 'string' && gearId !== '' ? gearId : null
}

/** From the nightly copy of Firestore's runShoes and shoeSettings: a pick made today counts after the next sync. */
export function getShoeChoices(): ShoeChoices {
  const file = readJsonFile<{ runs?: unknown; settings?: unknown } | null>(dataPath('shoe_choices.json'), null)
  if (!file) return NO_SHOE_CHOICES
  const runs = new Map<string, string>()
  if (typeof file.runs === 'object' && file.runs !== null) {
    for (const [activityId, doc] of Object.entries(file.runs)) {
      const gearId = gearIdOf(doc)
      if (gearId) runs.set(activityId, gearId)
    }
  }
  const settings = typeof file.settings === 'object' && file.settings !== null ? (file.settings as Record<string, unknown>) : {}
  return { runs, defaultGearId: gearIdOf(settings.default) }
}
