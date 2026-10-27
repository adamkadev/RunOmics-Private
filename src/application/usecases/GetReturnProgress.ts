import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import type { TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { archivedPlans, buildCoachingOverview } from '@/application/coaching/GetCoachingView'
import { isRunningActivity } from '@/domain/training/trainingHistory'
import {
  RETURN_MILESTONES,
  latestReturnBreak,
  returnMilestones,
  returnWeeks,
  runningTime,
  type ReturnMilestone,
  type ReturnMilestoneKey,
  type ReturnWeek,
} from '@/domain/training/returnProgress'
import { DAY_MS, appTodayIso } from '@/lib/calendarDate'

// Past a year a return is history, not progress.
const RETURN_HORIZON_DAYS = 365
// The Plan card stays this long after the 30-minute run, so the athlete sees it reached.
const CARD_AFTER_RETURN_DAYS = 14

export interface ReturnProgress {
  breakStart: string
  breakEnd: string
  milestones: ReturnMilestone[]
  /** In the order they are usually reached. */
  pending: ReturnMilestoneKey[]
  longestSec: number
  weeks: ReturnWeek[]
  /** False once the 30-minute run is more than two weeks old: Plan then drops its card. */
  ongoing: boolean
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/** The day the last session of the first block begun after the break was run, if every session of it was. */
export function blockCompletedOn(
  plans: readonly CoachingPlan[],
  evaluations: WorkoutEvaluation[],
  activities: Activity[],
  breakEnd: string,
  today: string,
): string | null {
  const byId = new Map(activities.map((activity) => [activity.id, activity]))
  const completedOn = plans
    .filter((plan) => plan.block.startDate > breakEnd)
    .map((plan) => {
      const sessions = buildCoachingOverview(plan, evaluations, activities, today).workouts.filter((view) => view.state !== 'cancelled')
      if (!sessions.length || sessions.some((view) => view.state !== 'completed')) return null
      return sessions.map((view) => byId.get(view.activityId ?? '')?.date.slice(0, 10) ?? view.prescription.date).sort().at(-1)!
    })
    .filter((date): date is string => date !== null)
    .sort()
  return completedOn[0] ?? null
}

export interface ReturnInputs {
  breaks: TrainingBreak[] | undefined
  activities: Activity[]
  plans: CoachingPlan[]
  evaluations: WorkoutEvaluation[]
}

export function buildReturnProgress({ breaks, activities, plans, evaluations }: ReturnInputs, today: string): ReturnProgress | null {
  const pause = latestReturnBreak(breaks)
  if (!pause || pause.end >= today || daysBetween(pause.end, today) > RETURN_HORIZON_DAYS) return null

  const runs = activities.filter(isRunningActivity).filter((run) => run.date.slice(0, 10) <= today)
  const milestones = returnMilestones(runs, pause.end, blockCompletedOn(plans, evaluations, activities, pause.end, today))
  const reached = new Set(milestones.map((milestone) => milestone.key))
  const returned = milestones.find((milestone) => milestone.key === 'continuous30')
  const since = runs.filter((run) => run.date.slice(0, 10) > pause.end)

  return {
    breakStart: pause.start,
    breakEnd: pause.end,
    milestones,
    pending: RETURN_MILESTONES.filter((key) => !reached.has(key)),
    longestSec: Math.max(0, ...since.map((run) => runningTime(run)?.longestSec ?? 0)),
    weeks: returnWeeks(runs, pause.end, today),
    ongoing: !returned || daysBetween(returned.date, today) <= CARD_AFTER_RETURN_DAYS,
  }
}

export function getReturnProgress(today: string = appTodayIso()): ReturnProgress | null {
  const repository = new JsonCoachingRepository()
  const current = repository.getCurrentPlan()
  return buildReturnProgress({
    breaks: getAthleteProfile().trainingBreaks,
    activities: getAllActivities(),
    plans: [...(current ? [current] : []), ...archivedPlans(repository)],
    evaluations: repository.getEvaluations(),
  }, today)
}
