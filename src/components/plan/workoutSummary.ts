import type { WorkoutStep } from '@/domain/activity/types'
import type { PlanWorkoutView } from './planWorkoutView'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

export interface WorkoutSummary {
  title: string
  shortTitle: string
  durationSeconds: number | null
  distanceM: number | null
  /** Each pace named, never merged: one range spanning them prescribes nothing. */
  paces: { kind: 'easy' | 'strides' | 'work' | 'target'; pace: [number, number] }[]
  repCaption: string | null
}

// A block this many times the others' average is the easy body, not a work interval.
const BODY_RATIO = 3
const STRIDE_MAX_SECONDS = 60

export function stepSeconds(step: WorkoutStep): number {
  return step.seconds ?? step.minutes * 60
}

export function findBody(efforts: WorkoutStep[]): WorkoutStep | null {
  if (efforts.length < 2) return null
  const sorted = [...efforts].sort((a, b) => stepSeconds(b) - stepSeconds(a))
  const longest = sorted[0]!
  const restAvg = sorted.slice(1).reduce((sum, e) => sum + stepSeconds(e), 0) / (sorted.length - 1)
  return stepSeconds(longest) >= Math.max(restAvg * BODY_RATIO, restAvg + 180) ? longest : null
}

export function stepClock(seconds: number): string {
  return seconds < 60 ? t.plan.session.seconds(Math.round(seconds)) : formatClock(seconds)
}

export function sessionParts(steps: WorkoutStep[]): { body: WorkoutStep | null; reps: WorkoutStep[]; strides: boolean } {
  const efforts = steps.filter((s) => s.kind === 'effort')
  const body = findBody(efforts)
  const reps = body ? efforts.filter((e) => e !== body) : efforts.length > 1 ? efforts : []
  return { body, reps, strides: !!body && reps.length > 0 && stepSeconds(reps[0]!) <= STRIDE_MAX_SECONDS }
}

export function repCaption(steps: WorkoutStep[]): string | null {
  const efforts = steps.filter((s) => s.kind === 'effort')
  if (efforts.length < 2) return null
  const body = findBody(efforts)
  const reps = body ? efforts.filter((e) => e !== body) : efforts
  const recovery = steps.find((s) => s.kind === 'recovery')
  // Older synced steps can be 0 min: count them, don't print "0s".
  const repSeconds = stepSeconds(reps[0]!)
  const rep = repSeconds > 0 ? `${reps.length} × ${stepClock(repSeconds)}` : t.plan.session.repsOnly(reps.length)
  return recovery ? t.plan.session.withRecovery(rep, stepClock(stepSeconds(recovery))) : rep
}

export function workoutSummary(
  view: Pick<PlanWorkoutView, 'title' | 'shortName' | 'duration' | 'distanceM' | 'structure'>,
): WorkoutSummary {
  const steps = view.structure ?? []
  const efforts = steps.filter((s) => s.kind === 'effort')
  const { body, reps, strides } = sessionParts(steps)
  const s = t.plan.session

  // A coach-named session (with a shortName) keeps its title; an older title is
  // rebuilt from the steps, never by reading the name.
  const title = strides && !view.shortName
    ? s.stridesTitle(Math.round(stepSeconds(body!) / 60), reps.length, stepClock(stepSeconds(reps[0]!)))
    : view.title

  const paces: WorkoutSummary['paces'] = []
  if (strides) {
    if (body!.paceSecPerKm) paces.push({ kind: 'easy', pace: body!.paceSecPerKm })
    if (reps[0]!.paceSecPerKm) paces.push({ kind: 'strides', pace: reps[0]!.paceSecPerKm })
  } else if (reps.length > 0) {
    if (reps[0]!.paceSecPerKm) paces.push({ kind: 'work', pace: reps[0]!.paceSecPerKm })
  } else if (efforts[0]?.paceSecPerKm) {
    paces.push({ kind: 'target', pace: efforts[0].paceSecPerKm })
  }

  return {
    title,
    shortTitle: view.shortName ?? title,
    durationSeconds: view.duration?.seconds ?? null,
    distanceM: view.distanceM,
    paces,
    repCaption: repCaption(steps),
  }
}

export function paceLabel({ kind, pace }: WorkoutSummary['paces'][number]): string {
  const s = t.plan.session
  const range = `${formatClock(pace[0])}–${formatClock(pace[1])}`
  if (kind === 'strides') return s.stridesPace(formatClock(pace[0]))
  if (kind === 'easy') return s.easyPace(range)
  return s.targetPace(range)
}
