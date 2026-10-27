import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { WALK_PACE_FLOOR_SEC_PER_KM } from '@/domain/coaching/sessionDistance'
import { WORKOUT_SEGMENT_COLORS, sessionZone, zoneColor } from '@/lib/colors'
import { formatClock, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'
import { kindLabel, type SessionKind } from './sessionKind'
import { sessionParts, stepClock, stepSeconds } from './workoutSummary'

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
  duration: string
}

const EASE_FILL = WORKOUT_SEGMENT_COLORS.warmup
/** Strides draw in Z5, as Today's bar draws them. */
const STRIDE_FILL = zoneColor(5)

export function stepLength(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? t.plan.steps.minutes(seconds / 60) : stepClock(seconds)
}

const rangeText = ([low, high]: [number, number]) => `${formatClock(low)}–${formatClock(high)}`

function paceText(step: WorkoutStep | undefined): string | null {
  const pace = step?.paceSecPerKm
  return pace ? t.plan.row.pace(rangeText(pace)) : null
}

/** A break without a target is a walk only in an easy session: a quality session's jog recoveries carry none either. */
function isWalk(step: WorkoutStep, runWalk: boolean): boolean {
  const pace = step.paceSecPerKm
  return pace ? pace[0] >= WALK_PACE_FLOOR_SEC_PER_KM : runWalk
}

function easeRow(key: string, title: string, parts: WorkoutStep[], runWalk: boolean): StepRow {
  const ranges = parts.flatMap((step) => (step.paceSecPerKm ? [rangeText(step.paceSecPerKm)] : []))
  const seconds = parts.reduce((sum, step) => sum + stepSeconds(step), 0)
  const detail = parts.every((step) => isWalk(step, runWalk))
    ? t.plan.steps.walk
    : ranges.length > 0 ? t.plan.row.pace(ranges.join(' → ')) : t.plan.steps.easy
  return { key, tone: 'ease', fill: EASE_FILL, title, detail, duration: stepLength(seconds) }
}

function setSpanSeconds(list: WorkoutStep[], reps: WorkoutStep[]): number {
  const first = list.indexOf(reps[0]!)
  const last = list.lastIndexOf(reps[reps.length - 1]!)
  if (first < 0 || last < first) return 0
  return list.slice(first, last + 1).reduce((sum, step) => sum + stepSeconds(step), 0)
}

function trimmed(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.at(-1)?.kind === 'recovery' ? steps.slice(0, -1) : steps
}

export function intensityBlocks(steps: WorkoutStep[] | null, totalSeconds: number, color: string): ProfileBlock[] {
  const list = trimmed(steps ?? [])
  if (list.length <= 1) return [{ tone: 'work', seconds: Math.max(totalSeconds, 1), fill: color }]
  const { body, strides } = sessionParts(list)
  const blocks = list.map<ProfileBlock>((step) => {
    const seconds = Math.max(stepSeconds(step), 1)
    if (step.kind === 'warmup' || step.kind === 'cooldown') return { tone: 'ease', seconds, fill: EASE_FILL }
    if (step.kind === 'recovery') return { tone: 'recovery', seconds, fill: EASE_FILL }
    return { tone: 'work', seconds, fill: strides && step !== body ? STRIDE_FILL : color }
  })
  return blocks.reduce<ProfileBlock[]>((merged, block) => {
    const last = merged.at(-1)
    if (last && last.tone === block.tone && last.fill === block.fill) last.seconds += block.seconds
    else merged.push({ ...block })
    return merged
  }, [])
}

interface StepSession {
  steps: WorkoutStep[] | null
  type: ActivityType
  kind: SessionKind
  color: string
  totalSeconds: number
  pace?: string | null
}

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
  const warmups = list.filter((step) => step.kind === 'warmup')
  const cooldowns = list.filter((step) => step.kind === 'cooldown')
  const recovery = list.find((step) => step.kind === 'recovery')
  const { body, reps, strides } = sessionParts(list)
  const efforts = list.filter((step) => step.kind === 'effort')
  const runWalk = kind === 'easy' && !strides

  if (warmups.length > 0) rows.push(easeRow('warmup', s.warmup, warmups, runWalk))
  if (body) {
    rows.push({ key: 'body', tone: 'work', fill: color, title: label, detail: join(zone, paceText(body)), duration: stepLength(stepSeconds(body)) })
  } else if (efforts.length === 1) {
    rows.push({ key: 'body', tone: 'work', fill: color, title: label, detail: join(zone, paceText(efforts[0])), duration: stepLength(stepSeconds(efforts[0]!)) })
  }
  if (reps.length > 0) {
    const rep = stepLength(stepSeconds(reps[0]!))
    const rec = recovery
      ? (isWalk(recovery, runWalk) ? t.plan.row.walk : t.plan.row.recovery)(stepClock(stepSeconds(recovery)))
      : null
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
  if (cooldowns.length > 0) rows.push(easeRow('cooldown', s.cooldown, cooldowns, runWalk))
  return rows
}
