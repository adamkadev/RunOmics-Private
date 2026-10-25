import type { Activity } from '@/domain/activity/types'
import type {
  AggregateWorkoutComparison,
  CoachDecisionOutcome,
  CoachTrigger,
  NumberRange,
  WorkoutPrescription,
} from '@/domain/coaching/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import {
  autoregulationReport,
  controlledStep,
  readControlledSession,
  type AutoregulationReport,
  type ControlledSessionReading,
  type GuideProposal,
  type SessionVerdict,
} from './autoregulation'
import { CONTROLLED_THRESHOLD, type RepLengthClass } from './controlledThreshold'
import { archivedPlans, type CoachingOverview } from './GetCoachingView'

export interface ControlledRunView {
  reading: ControlledSessionReading
  windowStartSeconds: number
}

/** The run read as autoregulate reads it, so the page and the terminal agree on its verdict. */
export function controlledRunView(activity: Activity, session: WorkoutPrescription | null): ControlledRunView | null {
  const reading = session ? readControlledSession(activity, session) : null
  return reading ? { reading, windowStartSeconds: CONTROLLED_THRESHOLD.autoregulation.windowStartSeconds } : null
}

/** Facts only: the coach's written summaries stay off the page payload, as the rest of the plan's reasoning does. */
export interface CoachReadout {
  decision: { outcome: CoachDecisionOutcome; trigger: CoachTrigger; date: string } | null
  evaluation: { date: string; activityId: string; comparison: AggregateWorkoutComparison } | null
  nextKey: { date: string; title: string } | null
  controlled: { date: string; activityId: string; repClass: RepLengthClass; verdict: SessionVerdict } | null
  guideProposals: Pick<GuideProposal, 'repClass' | 'direction' | 'guide' | 'proposedGuide'>[]
  fatigue: { date: string; aboveNormalBpm: number } | null
  fitnessCheck: { date: string; paceSecPerKm: number; impliedThresholdSecPerKm: number; proposedGuides: { repClass: RepLengthClass; proposedGuide: NumberRange }[] } | null
}

export function coachReadout(overview: CoachingOverview, report: AutoregulationReport | null): CoachReadout {
  const { latestDecision: decision, latestEvaluation: evaluation, nextKeyWorkout: nextKey } = overview
  const controlled = report?.controlledSessions.filter((session) => session.verdict !== 'unreadable').at(-1)
  const fatigue = report?.fatigue?.flagged && report.fatigue.normalHr !== null ? report.fatigue : null
  const check = report?.fitnessCheck ?? null
  return {
    decision: decision ? { outcome: decision.outcome, trigger: decision.trigger, date: decision.createdAt.slice(0, 10) } : null,
    // An evaluation of an earlier block's run says nothing about this one.
    evaluation: evaluation?.planId === overview.plan.id && evaluation.matchStatus === 'matched' && evaluation.comparison
      ? { date: evaluation.activityDate.slice(0, 10), activityId: evaluation.activityId, comparison: evaluation.comparison }
      : null,
    nextKey: nextKey ? { date: nextKey.prescription.date, title: nextKey.prescription.shortName ?? nextKey.prescription.title } : null,
    controlled: controlled ? { date: controlled.date, activityId: controlled.activityId, repClass: controlled.repClass, verdict: controlled.verdict } : null,
    guideProposals: (report?.guideProposals ?? []).map(({ repClass, direction, guide, proposedGuide }) => ({ repClass, direction, guide, proposedGuide })),
    fatigue: fatigue ? { date: fatigue.run.date, aboveNormalBpm: Math.round(fatigue.run.hr - fatigue.normalHr!) } : null,
    fitnessCheck: check
      ? {
          date: check.date,
          paceSecPerKm: check.paceSecPerKm,
          impliedThresholdSecPerKm: check.impliedThresholdSecPerKm,
          proposedGuides: check.proposedGuides.map(({ repClass, proposedGuide }) => ({ repClass, proposedGuide })),
        }
      : null,
  }
}

/** Read as context.autoregulation is: only while the plan prescribes controlled threshold sessions. */
export function getCoachReadout(overview: CoachingOverview, today: string): CoachReadout {
  const controlled = overview.plan.weeks.some((week) => week.workouts.some((workout) => controlledStep(workout) !== null))
  const report = controlled
    ? autoregulationReport(getAllActivities(), [overview.plan, ...archivedPlans()], today, getOfficialRaceResults())
    : null
  return coachReadout(overview, report)
}
