import type { Activity, ActivityType } from '@/domain/activity/types'
import { intendedType } from '@/lib/activityTitle'
import { COACHING_TO_ACTIVITY_TYPE, type CoachingPlan, type WorkoutEvaluation, type WorkoutPrescription } from './types'

type SessionPrescription = Pick<WorkoutPrescription, 'date' | 'type' | 'status'> & { title?: string }

export interface RunSession<P extends SessionPrescription = WorkoutPrescription> {
  prescription: P
  activityId: string | null
}

export type SessionRun = Pick<Activity, 'id' | 'date' | 'type'> & {
  description?: string | null
  typeSource?: Activity['typeSource']
}

const QUALITY_TYPES: readonly ActivityType[] = ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic']

function family(type: ActivityType): 'easy' | 'quality' | null {
  if (type === 'Base') return 'easy'
  return QUALITY_TYPES.includes(type) ? 'quality' : null
}

/** Garmin names a run after the workout sent to the watch, which spells the primes in ASCII. */
function nameKey(name: string): string {
  return name.replaceAll('′', "'").replaceAll('″', '"').replace(/\s+/g, ' ').trim().toLowerCase()
}

function only<T>(candidates: T[]): T | null {
  return candidates.length === 1 ? candidates[0]! : null
}

/** A type RunOmics guessed is no evidence of the session, so such a run takes its day's only session whatever its kind. */
export function sessionForRun<P extends SessionPrescription>(run: SessionRun, sessions: readonly RunSession<P>[]): P | null {
  const linked = sessions.find((session) => session.activityId === run.id)
  if (linked) return linked.prescription
  const day = sessions
    .filter((s) => s.activityId === null && s.prescription.status !== 'cancelled' && s.prescription.date === run.date.slice(0, 10))
    .map((s) => s.prescription)
  if (day.length === 0) return null
  const name = nameKey(run.description ?? '')
  const intended = intendedType(run)
  const typeOf = (prescription: P) => COACHING_TO_ACTIVITY_TYPE[prescription.type]
  return only(day.filter((p) => name !== '' && p.title !== undefined && nameKey(p.title) === name))
    ?? only(day.filter((p) => typeOf(p) === intended))
    ?? only(day.filter((p) => family(intended) !== null && family(typeOf(p)) === family(intended)))
    ?? (run.typeSource === 'runomics' ? only(day) : null)
}

/** `plans` newest first; an older plan's session counts only on a day no newer plan's weeks cover. */
export function sessionsAcrossPlans(plans: readonly CoachingPlan[], evaluations: readonly WorkoutEvaluation[]): RunSession[] {
  const matched = new Map(evaluations
    .filter((evaluation) => evaluation.matchStatus === 'matched' && evaluation.prescriptionId !== null)
    .map((evaluation) => [evaluation.prescriptionId!, evaluation.activityId]))
  const covered: { startDate: string; endDate: string }[] = []
  const sessions: RunSession[] = []
  for (const plan of plans) {
    for (const prescription of plan.weeks.flatMap((week) => week.workouts)) {
      if (covered.some((week) => prescription.date >= week.startDate && prescription.date <= week.endDate)) continue
      sessions.push({ prescription, activityId: matched.get(prescription.id) ?? null })
    }
    covered.push(...plan.weeks)
  }
  return sessions
}
