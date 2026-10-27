import type { Activity } from '@/domain/activity/types'
import type { ShoeRecord } from './types'

/** The owner's picks from the app, as the nightly sync mirrors them into shoe_choices.json. */
export interface ShoeChoices {
  runs: ReadonlyMap<string, string>
  defaultGearId: string | null
}

export const NO_SHOE_CHOICES: ShoeChoices = { runs: new Map(), defaultGearId: null }

type Resolved = Pick<Activity, 'gearId' | 'gearSource'>

/** A pick of a shoe the list no longer has is ignored, so a run never counts toward a shoe no page can show. */
export function resolveShoe(activity: Pick<Activity, 'id' | 'date' | 'gearId'>, choices: ShoeChoices, shoes: readonly ShoeRecord[]): Resolved | null {
  const known = (gearId: string | null | undefined) => (gearId ? shoes.find((shoe) => shoe.gearId === gearId) : undefined)
  const chosen = known(choices.runs.get(activity.id))
  if (chosen) return { gearId: chosen.gearId, gearSource: 'choice' }
  if (activity.gearId) return null
  const fallback = known(choices.defaultGearId)
  // Before the pair's first use the run was in other shoes, or none the athlete tracked.
  if (!fallback || (fallback.firstUseDate && activity.date.slice(0, 10) < fallback.firstUseDate.slice(0, 10))) return null
  return { gearId: fallback.gearId, gearSource: 'default' }
}

export function withShoeChoices(activities: Activity[], choices: ShoeChoices, shoes: readonly ShoeRecord[]): Activity[] {
  if (shoes.length === 0 || (choices.runs.size === 0 && !choices.defaultGearId)) return activities
  return activities.map((activity) => {
    const resolved = resolveShoe(activity, choices, shoes)
    if (!resolved) return activity
    const picked: Activity = { ...activity, ...resolved }
    delete picked.gearPending
    return picked
  })
}
