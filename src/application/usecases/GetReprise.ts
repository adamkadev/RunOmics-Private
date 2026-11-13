import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import type { TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { archivedPlans } from '@/application/coaching/GetCoachingView'
import { isRunningActivity } from '@/domain/training/trainingHistory'
import { latestReturnBreak } from '@/domain/training/returnProgress'
import { appTodayIso } from '@/lib/calendarDate'

/** A runner back from a long break, while the plan's first block after it runs: windows start at the return. */
export interface Reprise {
  /** The first run after the break. */
  since: string
  breakStart: string
  breakEnd: string
}

export function buildReprise(
  breaks: readonly TrainingBreak[] | undefined,
  plans: readonly CoachingPlan[],
  activities: readonly Activity[],
  today: string,
): Reprise | null {
  const pause = latestReturnBreak(breaks)
  if (!pause || pause.end >= today) return null
  const block = plans.map((plan) => plan.block).filter((b) => b.startDate > pause.end).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  if (!block || today < block.startDate || today > block.endDate) return null
  const first = activities
    .filter((run) => isRunningActivity(run) && run.date.slice(0, 10) > pause.end)
    .map((run) => run.date.slice(0, 10))
    .sort()[0]
  return { since: first ?? block.startDate, breakStart: pause.start, breakEnd: pause.end }
}

export function getReprise(today: string = appTodayIso()): Reprise | null {
  const repository = new JsonCoachingRepository()
  const current = repository.getCurrentPlan()
  return buildReprise(getAthleteProfile().trainingBreaks, [...(current ? [current] : []), ...archivedPlans(repository)], getAllActivities(), today)
}
