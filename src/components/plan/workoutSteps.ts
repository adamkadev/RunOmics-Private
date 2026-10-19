import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { WORKOUT_SEGMENT_COLORS, sessionZone, zoneColor } from '@/lib/colors'
import { formatClock, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'
import { kindLabel, type SessionKind } from './sessionKind'
import { sessionParts, stepClock, stepSeconds } from './workoutSummary'

/**
 * The selected workout's intensity profile and steps (redesign 3.0, 1d): one
 * block per step, as wide as it lasts - warm-up, cool-down and the jog
 * between reps low and neutral, the work full height in the session's colour
 * - and under it the same session as a list of rows.
 */
export type StepTone = 'ease' | 'work' | 'recovery'

export interface ProfileBlock {
  tone: StepTone
  seconds: number
  fill: string
}

export interface StepRow {
  key: string
  tone: StepTone
  fill: string
  title: string
  detail: string | null
  /** "15′", "3×8′", "6×20s". */
  duration: string
}

const EASE_FILL = WORKOUT_SEGMENT_COLORS.warmup
const RECOVERY_FILL = WORKOUT_SEGMENT_COLORS.recovery
/** Strides inside an easy run are drawn at max, as Today's bar draws them. */
const STRIDE_FILL = zoneColor(5)

/** "15′" for whole minutes, "20s" and "1:30" otherwise. */
export function stepLength(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? t.plan.steps.minutes(seconds / 60) : stepClock(seconds)
}

function paceText(step: WorkoutStep | undefined): string | null {
  const pace = step?.paceSecPerKm
  return pace ? t.plan.row.pace(`${formatClock(pace[0])}–${formatClock(pace[1])}`) : null
}

function setSpanSeconds(list: WorkoutStep[], reps: WorkoutStep[]): number {
  const first = list.indexOf(reps[0]!)
  const last = list.lastIndexOf(reps[reps.length - 1]!)
  if (first < 0 || last < first) return 0
  return list.slice(first, last + 1).reduce((sum, step) => sum + stepSeconds(step), 0)
}

/** A session never ends on the jog after its last rep. */
function trimmed(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.at(-1)?.kind === 'recovery' ? steps.slice(0, -1) : steps
}

/** The profile's blocks: a session without steps is one block of work. */
export function intensityBlocks(steps: WorkoutStep[] | null, totalSeconds: number, color: string): ProfileBlock[] {
  const list = trimmed(steps ?? [])
  if (list.length <= 1) return [{ tone: 'work', seconds: Math.max(totalSeconds, 1), fill: color }]
  const { body, strides } = sessionParts(list)
  return list.map((step) => {
    const seconds = Math.max(stepSeconds(step), 1)
    if (step.kind === 'warmup' || step.kind === 'cooldown') return { tone: 'ease', seconds, fill: EASE_FILL }
    if (step.kind === 'recovery') return { tone: 'recovery', seconds, fill: RECOVERY_FILL }
    return { tone: 'work', seconds, fill: strides && step !== body ? STRIDE_FILL : color }
  })
}

interface StepSession {
  steps: WorkoutStep[] | null
  type: ActivityType
  kind: SessionKind
  color: string
  totalSeconds: number
  /** The session's pace when it has no steps to carry one: "5:10–6:27 /km". */
  pace?: string | null
}

/**
 * The steps as rows: the warm-up, the work - its reps grouped into one row,
 * "3 × 8′ threshold", or the easy body and its strides - then the cool-down.
 */
export function stepRows({ steps, type, kind, color, totalSeconds, pace = null }: StepSession): StepRow[] {
  const s = t.plan.steps
  const zone = t.trainingZones.zoneNumber(sessionZone({ type }))
  const label = kindLabel(type, kind)
  const list = trimmed(steps ?? [])
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null

  if (list.length <= 1) {
    const seconds = list[0] ? stepSeconds(list[0]) : totalSeconds
    return [{ key: 'main', tone: 'work', fill: color, title: label, detail: join(zone, paceText(list[0]) ?? pace), duration: seconds > 0 ? formatDurationWords(seconds) : '' }]
  }

  const rows: StepRow[] = []
  const warmup = list.find((step) => step.kind === 'warmup')
  const cooldown = list.find((step) => step.kind === 'cooldown')
  const recovery = list.find((step) => step.kind === 'recovery')
  const { body, reps, strides } = sessionParts(list)
  const efforts = list.filter((step) => step.kind === 'effort')

  if (warmup) rows.push({ key: 'warmup', tone: 'ease', fill: EASE_FILL, title: s.warmup, detail: paceText(warmup) ?? s.easy, duration: stepLength(stepSeconds(warmup)) })
  if (body) {
    rows.push({ key: 'body', tone: 'work', fill: color, title: label, detail: join(zone, paceText(body)), duration: stepLength(stepSeconds(body)) })
  } else if (efforts.length === 1) {
    rows.push({ key: 'body', tone: 'work', fill: color, title: label, detail: join(zone, paceText(efforts[0])), duration: stepLength(stepSeconds(efforts[0]!)) })
  }
  if (reps.length > 0) {
    const rep = stepLength(stepSeconds(reps[0]!))
    const rec = recovery ? t.plan.row.recovery(stepClock(stepSeconds(recovery))) : null
    const setSeconds = setSpanSeconds(list, reps)
    rows.push({
      key: 'reps',
      tone: 'work',
      fill: strides ? STRIDE_FILL : color,
      title: strides ? s.strides(reps.length, rep) : s.reps(reps.length, rep, label.toLocaleLowerCase(t.locale)),
      detail: join(strides ? null : zone, paceText(reps[0]), rec),
      duration: setSeconds > 0 ? stepLength(setSeconds) : s.repsShort(reps.length, rep),
    })
  }
  if (cooldown) rows.push({ key: 'cooldown', tone: 'ease', fill: EASE_FILL, title: s.cooldown, detail: paceText(cooldown) ?? s.easy, duration: stepLength(stepSeconds(cooldown)) })
  return rows
}
