import type { Activity } from '@/domain/activity/types'
import type { ShoeRecord } from './types'

/** The owner's picks from the app, as the nightly sync mirrors them into shoe_choices.json. */
export interface ShoeChoices {
  runs: ReadonlyMap<string, string>
}

export const NO_SHOE_CHOICES: ShoeChoices = { runs: new Map() }

type Resolved = Pick<Activity, 'gearId' | 'gearSource'>

/** A pick of a shoe the list no longer has is ignored, so a run never counts toward a shoe no page can show. */
function resolveShoe(activity: Pick<Activity, 'id'>, choices: ShoeChoices, shoes: readonly ShoeRecord[]): Resolved | null {
  const chosen = shoes.find((shoe) => shoe.gearId === choices.runs.get(activity.id))
  return chosen ? { gearId: chosen.gearId, gearSource: 'choice' } : null
}

export function withShoeChoices(activities: Activity[], choices: ShoeChoices, shoes: readonly ShoeRecord[]): Activity[] {
  if (shoes.length === 0 || choices.runs.size === 0) return activities
  return activities.map((activity) => {
    const resolved = resolveShoe(activity, choices, shoes)
    if (!resolved) return activity
    const picked: Activity = { ...activity, ...resolved }
    delete picked.gearPending
    return picked
  })
}
