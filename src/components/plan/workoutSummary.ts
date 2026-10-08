import type { WorkoutStep } from '@/domain/activity/types'
import type { PlanWorkoutView } from './planWorkoutView'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * One reading of a planned session, which Today, Plan and the structure bar
 * all draw from (H02). Today said "Strides 6 × 20s · 59 min · 3:35–7:00/km"
 * while Plan said "6 × 1:00 · 1:00 rec · 3:35–6:24": the reps were rounded up
 * to a minute and the paces merged into one range that prescribed nothing.
 */
export interface WorkoutSummary {
  title: string
  /** A tight row's name: the coach's short name, else the title. */
  shortTitle: string
  durationSeconds: number | null
  distanceM: number | null
  /** The session's paces, each named, never merged into one range. */
  paces: { kind: 'easy' | 'strides' | 'work' | 'target'; pace: [number, number] }[]
  /** "6 × 20s · 1:00 rec", or null for a continuous run. */
  repCaption: string | null
}

// A block this many times longer than the reps around it is the run's easy
// body, not a work interval - "3 x 8min" (all equal) never qualifies, but a
// 38-minute base pace ahead of five 20-second strides does.
const BODY_RATIO = 3
/** Reps this short inside an easy body are strides, not intervals. */
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

/** "20s", "1:00", "1:40": a rep or a recovery, to the second. */
export function stepClock(seconds: number): string {
  return seconds < 60 ? t.plan.session.seconds(Math.round(seconds)) : formatClock(seconds)
}

/**
 * A session's parts as its steps give them: the easy body, when one block
 * dwarfs the rest, the reps around it or making it up, and whether those reps
 * are strides. Titles, captions and Today's bar all read a session this way.
 */
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
  // A step synced before seconds were kept is 0 min: count it, don't print "0s".
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

  // A session the coach named under the naming rules says what it is as
  // written (design review, Oct 2026): "Easy · 54 min + 6 strides". Only an
  // older title, "Strides 6 x 20s", is rebuilt - from the steps, never by
  // reading the name.
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

/** A pace as a detail line writes it: strides by their fast end, the rest as a range. */
export function paceLabel({ kind, pace }: WorkoutSummary['paces'][number]): string {
  const s = t.plan.session
  const range = `${formatClock(pace[0])}–${formatClock(pace[1])}`
  if (kind === 'strides') return s.stridesPace(formatClock(pace[0]))
  if (kind === 'easy') return s.easyPace(range)
  return s.targetPace(range)
}
