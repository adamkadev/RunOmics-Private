import { DAY_MS } from '@/lib/calendarDate'
import type { CoachingPlan } from './types'

/** A block opens on a Monday at most this far out, so the days kept from the current plan fill no more than one week. */
export const BOOTSTRAP_START_WINDOW_DAYS = 7

export interface RenewalDefaults {
  availableWeekdays?: number[]
  runsPerWeek?: number
  /** The Monday after the block's last day, where that falls inside the window bootstrap accepts. */
  start?: string
}

function mondayAfter(date: string): string {
  const monday = new Date(`${date}T00:00:00Z`)
  do {
    monday.setUTCDate(monday.getUTCDate() + 1)
  } while (monday.getUTCDay() !== 1)
  return monday.toISOString().slice(0, 10)
}

export function renewalDefaults(
  plan: Pick<CoachingPlan, 'block' | 'trainingPreferences'> | null,
  referenceDate: string,
): RenewalDefaults {
  if (!plan) return {}

  const start = mondayAfter(plan.block.endDate)
  const latest = new Date(Date.parse(`${referenceDate}T00:00:00Z`) + BOOTSTRAP_START_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10)
  const { availableWeekdays, runsPerWeek } = plan.trainingPreferences ?? {}

  return {
    ...(availableWeekdays?.length ? { availableWeekdays } : {}),
    ...(runsPerWeek ? { runsPerWeek } : {}),
    ...(start > referenceDate && start <= latest ? { start } : {}),
  }
}
