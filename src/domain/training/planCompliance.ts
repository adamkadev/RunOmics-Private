import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { trimp, type HrBounds } from './trimp'

export type DayComplianceStatus = 'done' | 'missed' | 'extra' | 'rest' | 'upcoming'

export interface DayComplianceInput {
  date: string
  activities: Activity[]
  planned?: PlannedWorkout
}

export interface DayCompliance extends DayComplianceInput {
  status: DayComplianceStatus
}

export interface WeekCompliance {
  days: DayCompliance[]
  /** % of due (date <= today) planned sessions actually run. Null with no due plans. */
  sessionsCompliancePct: number | null
  /** % of due planned load actually realized (TRIMP). Null with no due planned load. */
  loadCompliancePct: number | null
}

function dayStatus({ date, activities, planned }: DayComplianceInput, today: string): DayComplianceStatus {
  if (activities.length > 0) return planned ? 'done' : 'extra'
  if (!planned) return 'rest'
  return date <= today ? 'missed' : 'upcoming'
}

export function buildWeekCompliance(inputs: DayComplianceInput[], today: string, hrBounds?: HrBounds): WeekCompliance {
  const days: DayCompliance[] = inputs.map((input) => ({ ...input, status: dayStatus(input, today) }))

  const duePlanned = days.filter((d) => d.planned && d.date <= today)
  const doneCount = duePlanned.filter((d) => d.status === 'done').length
  const sessionsCompliancePct = duePlanned.length ? Math.round((doneCount / duePlanned.length) * 100) : null

  const plannedLoad = duePlanned.reduce((s, d) => s + (d.planned?.estimatedLoad ?? 0), 0)
  const realizedLoad = duePlanned.reduce(
    (s, d) => s + d.activities.reduce((sa, a) => sa + trimp(a, hrBounds), 0),
    0,
  )
  const loadCompliancePct = plannedLoad > 0 ? Math.round((realizedLoad / plannedLoad) * 100) : null

  return { days, sessionsCompliancePct, loadCompliancePct }
}
