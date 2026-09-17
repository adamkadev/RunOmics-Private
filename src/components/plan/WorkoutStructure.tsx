import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatDurationWords, formatPaceRange } from '@/lib/formatters'
import { WORKOUT_SEGMENT_COLORS, WORKOUT_SEGMENT_INK } from '@/lib/colors'
import { t } from '@/i18n'

const STEP_COLOR: Record<WorkoutStep['kind'], string> = WORKOUT_SEGMENT_COLORS

const STEP_HEIGHT: Record<WorkoutStep['kind'], string> = {
  warmup:   '35%',
  effort:   '100%',
  recovery: '45%',
  cooldown: '35%',
}

/**
 * A segment is only labelled once it owns enough of the bar to hold two glyphs
 * and an apostrophe. Widths are proportional, so this is the only handle we
 * have on them; a session of ten one-minute reps falls below the line and stays
 * unlabelled, which is the right answer anyway - ten identical `1'` would say
 * nothing the ten blocks do not already say.
 */
const LABEL_MIN_SHARE = 0.07

export function WorkoutStructureBars({
  steps,
  className,
  labels = false,
}: {
  steps: WorkoutStep[]
  className?: string
  labels?: boolean
}) {
  const weights = steps.map((step) => Math.max(step.minutes, 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  return (
    <div
      className={className ?? 'flex h-[22px] items-end gap-[3px]'}
      aria-hidden={labels ? undefined : true}
    >
      {steps.map((step, i) => {
        const weight = weights[i]!
        const labelled = labels && step.kind === 'effort' && weight / total >= LABEL_MIN_SHARE
        return (
          <div
            key={i}
            className="flex items-center justify-center overflow-hidden rounded-[2px]"
            style={{
              flexGrow: weight,
              flexBasis: 0,
              height: STEP_HEIGHT[step.kind],
              background: STEP_COLOR[step.kind],
            }}
          >
            {labelled && (
              <span
                className="text-[11px] font-bold leading-none tabular-nums"
                style={{ color: WORKOUT_SEGMENT_INK.effort }}
              >
                {t.plan.structure.min(step.minutes)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The between-reps recovery, for surfaces that show the bar but not the step
 * list. Every recovery in a repeat block is the same length, so the first one
 * speaks for all of them.
 */
export function recoveryLabel(steps: WorkoutStep[] | null | undefined): string | null {
  const recovery = steps?.find((step) => step.kind === 'recovery')
  return recovery ? t.plan.structure.rec(recovery.minutes) : null
}

const CONTINUOUS_FILL = 'rgba(52,211,153,.7)'
const CONTINUOUS_INK = '#06231a'
const DONE_FILL = 'rgba(90,151,245,.55)'
const DONE_INK = '#0a1628'
const WORK_FILL = 'var(--delta-warn)'
const WORK_INK = '#2a1405'
const RECOVERY_FILL = 'rgba(90,151,245,.5)'
// Warm-up/cool-down need to read as segments, not gaps - .18 sat close
// enough to the card's own light-mode tint that they blended into it.
const EASE_FILL = 'rgba(148,178,220,.32)'

// A block this many times longer than the reps around it is the run's easy
// body, not a work interval - "3 x 8min" (all equal) never qualifies, but a
// 38-minute base pace ahead of five 20-second strides does.
const BODY_RATIO = 3

function findBody(efforts: WorkoutStep[]): WorkoutStep | null {
  if (efforts.length < 2) return null
  const sorted = [...efforts].sort((a, b) => b.minutes - a.minutes)
  const longest = sorted[0]!
  const restAvg = sorted.slice(1).reduce((sum, e) => sum + e.minutes, 0) / (sorted.length - 1)
  return longest.minutes >= Math.max(restAvg * BODY_RATIO, restAvg + 3) ? longest : null
}

/**
 * The day card's own structure bar - continuous, or interval, drawn only from
 * steps the plan actually carries. `variant` is the only thing that tells a
 * prescribed session from a logged one: green is "this is prescribed", blue
 * ("done") is "this happened" - completed activities have no logged interval
 * breakdown in this domain, so they always take the continuous path.
 */
export function SessionStructureBar({
  steps,
  zoneWord,
  totalSeconds,
  variant = 'planned',
}: {
  steps: WorkoutStep[]
  zoneWord: string | null
  totalSeconds: number
  variant?: 'planned' | 'done'
}) {
  const efforts = steps.filter((st) => st.kind === 'effort')
  const fill = variant === 'done' ? DONE_FILL : CONTINUOUS_FILL
  const ink = variant === 'done' ? DONE_INK : CONTINUOUS_INK

  if (efforts.length <= 1) {
    const label = [formatDurationWords(totalSeconds), [zoneWord, t.plan.continuous].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · ')
    return (
      <div
        className="flex items-center justify-center overflow-hidden rounded-[5px]"
        style={{ height: '22px', background: fill }}
      >
        <span className="font-bold leading-none" style={{ fontSize: '11.5px', color: ink }}>
          {label}
        </span>
      </div>
    )
  }

  // A session shouldn't finish mid-recovery: a rest jog tacked onto the very
  // end (no cool-down follows it) reads as an accident, not a plan, so it's
  // dropped rather than drawn as the bar's last block.
  const trimmedSteps = steps.length > 0 && steps[steps.length - 1]!.kind === 'recovery' ? steps.slice(0, -1) : steps

  const body = findBody(efforts)
  const reps = body ? efforts.filter((e) => e !== body) : efforts
  const recoveries = trimmedSteps.filter((st) => st.kind === 'recovery')
  const warmup = trimmedSteps.find((st) => st.kind === 'warmup')
  const cooldown = trimmedSteps.find((st) => st.kind === 'cooldown')

  // Every block's width is its own rounded duration except the body: that one
  // absorbs whatever's left of the session total instead of carrying its own
  // independently-rounded minutes, so the bar always closes on the header's
  // duration rather than drifting from rounding several short reps up to a
  // full minute apiece.
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const otherMinutes = trimmedSteps
    .filter((st) => st !== body)
    .reduce((sum, st) => sum + Math.max(st.minutes, 1), 0)
  const bodyWeight = body ? Math.max(1, totalMinutes - otherMinutes) : null

  const weights = trimmedSteps.map((step) => (step === body ? bodyWeight! : Math.max(step.minutes, 1)))
  const s = t.plan.structure
  const clock = (min: number) => `${min}:00`
  const centerCaption =
    reps.length > 0
      ? recoveries.length > 0
        ? `${reps.length} × ${clock(reps[0]!.minutes)} · ${clock(recoveries[0]!.minutes)} rec`
        : `${reps.length} × ${clock(reps[0]!.minutes)}`
      : ''

  return (
    <div>
      <div className="flex items-end" style={{ gap: '3px' }}>
        {trimmedSteps.map((step, i) => {
          const isBody = step === body
          const isWork = step.kind === 'effort' && !isBody
          const share = weights[i]! / totalMinutes
          const labelled = isWork && share >= LABEL_MIN_SHARE

          if (isBody) {
            const bodyLabel = `${formatDurationWords(bodyWeight! * 60)}${zoneWord ? ` · ${zoneWord}` : ''}`
            return (
              <div
                key={i}
                className="flex items-center justify-center overflow-hidden rounded-[4px]"
                style={{ flexGrow: weights[i], flexBasis: 0, height: '22px', background: fill }}
              >
                <span className="truncate font-bold leading-none" style={{ fontSize: '11px', color: ink }}>
                  {bodyLabel}
                </span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="flex items-center justify-center overflow-hidden rounded-[4px]"
              style={{
                flexGrow: weights[i],
                flexBasis: 0,
                height: isWork ? '22px' : '16px',
                background: isWork ? WORK_FILL : step.kind === 'recovery' ? RECOVERY_FILL : EASE_FILL,
              }}
            >
              {labelled && (
                <span className="font-bold leading-none" style={{ fontSize: '10px', color: WORK_INK }}>
                  {s.min(step.minutes)}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {(warmup || cooldown || centerCaption) && (
        <div className="mt-1.5 grid grid-cols-3 items-center" style={{ fontSize: '10.5px', color: 'var(--subtle-2)' }}>
          <span className="text-left">{warmup ? s.warmup : ''}</span>
          <span className="text-center">{centerCaption}</span>
          <span className="text-right">{cooldown ? s.cooldown : ''}</span>
        </div>
      )}
    </div>
  )
}

export function WorkoutStepList({ steps, type }: { steps: WorkoutStep[]; type?: ActivityType }) {
  const s = t.plan.structure
  const efforts = steps.filter((st) => st.kind === 'effort')
  const recoveries = steps.filter((st) => st.kind === 'recovery')
  const warmup = steps.find((st) => st.kind === 'warmup')
  const cooldown = steps.find((st) => st.kind === 'cooldown')
  const zoneLabel = (step: WorkoutStep | undefined, fallback: string) =>
    step?.paceSecPerKm ? formatPaceRange(step.paceSecPerKm) : fallback
  const zone = zoneLabel(efforts[0], (type && EFFORT_ZONE_BY_TYPE[type]) || s.easyZone)
  const effortMin = efforts[0]?.minutes ?? 0

  const intervalLabel =
    efforts.length === 1
      ? s.single(effortMin, zone)
      : recoveries.length > 0
        ? s.repsWithRecovery(efforts.length, effortMin, recoveries[0]?.minutes ?? 0, zone)
        : s.reps(efforts.length, effortMin, zone)

  const rows: { label: string; minutes: number | null; zone: string; accent: boolean }[] = []
  if (warmup) rows.push({ label: s.warmup, minutes: warmup.minutes, zone: s.easyZone, accent: false })
  rows.push({
    label: intervalLabel,
    minutes:
      efforts.length === 1
        ? null
        : efforts.reduce((sum, st) => sum + st.minutes, 0) + recoveries.reduce((sum, st) => sum + st.minutes, 0),
    zone,
    accent: true,
  })
  if (cooldown) rows.push({ label: s.cooldown, minutes: cooldown.minutes, zone: s.easyZone, accent: false })

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-xs">
          <span className={row.accent ? 'font-semibold text-white' : 'text-white/70'}>{row.label}</span>
          {row.minutes !== null && (
            <span className="shrink-0 tabular-nums text-white/50">{s.min(row.minutes)}</span>
          )}
        </div>
      ))}
    </div>
  )
}
