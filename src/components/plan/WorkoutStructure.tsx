import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatDurationWords, formatPaceRange } from '@/lib/formatters'
import { WORKOUT_SEGMENT_COLORS, WORKOUT_SEGMENT_INK } from '@/lib/colors'
import { t } from '@/i18n'
import { findBody, repCaption } from './workoutSummary'

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

/** The narrowest a step draws, in minutes of bar. */
const MIN_STEP_MINUTES = 0.35

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

// The bar is filled in the zone the session targets and written in --zone-ink,
// which clears 7:1 on Z3 and Z4. It used to be navy text on a mid-blue fill -
// about 3:1 - and the blue said Z2 on a Z4 session.
const ZONE_INK = 'var(--zone-ink)'
const RECOVERY_FILL = 'color-mix(in srgb, var(--zone-1) 60%, transparent)'
// Warm-up/cool-down need to read as segments, not gaps - .18 sat close
// enough to the card's own light-mode tint that they blended into it.
const EASE_FILL = 'color-mix(in srgb, var(--subtle) 32%, transparent)'

function zoneFill(zone: number | null): string {
  return `var(--zone-${zone ?? 2})`
}

/**
 * The day card's own structure bar - continuous, or interval, drawn only from
 * steps the plan actually carries. Colour is the session's intensity (its
 * zone); whether it was done or is still planned is the state chip's job, not
 * the bar's. Completed activities have no logged interval breakdown in this
 * domain, so they always take the continuous path.
 */
export function SessionStructureBar({
  steps,
  zoneWord,
  zone,
  totalSeconds,
  bare = false,
}: {
  steps: WorkoutStep[]
  zoneWord: string | null
  /** Today's hero (M7): every block full height and no caption, the title
   *  above already names the reps. */
  bare?: boolean
  /** The zone the session targets (RUN_TYPE_ZONE); Z2 when unknown. */
  zone: number | null
  totalSeconds: number
}) {
  const efforts = steps.filter((st) => st.kind === 'effort')
  const fill = zoneFill(zone)
  const ink = ZONE_INK
  // Short fast reps inside an easy run are strides: the reps take Z5, the body
  // keeps the session's own zone.
  const workFill = zone !== null && zone >= 3 ? fill : zoneFill(5)

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
  const warmup = trimmedSteps.find((st) => st.kind === 'warmup')
  const cooldown = trimmedSteps.find((st) => st.kind === 'cooldown')

  // Every block's width is its own rounded duration except the body: that one
  // absorbs whatever's left of the session total instead of carrying its own
  // independently-rounded minutes, so the bar always closes on the header's
  // duration rather than drifting from rounding several short reps up to a
  // full minute apiece.
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  // Short steps keep their real length (a 20 s stride is a third of a
  // minute), with a floor so each one still draws.
  const width = (step: WorkoutStep) => Math.max((step.seconds ?? step.minutes * 60) / 60, MIN_STEP_MINUTES)
  const otherMinutes = trimmedSteps.filter((st) => st !== body).reduce((sum, st) => sum + width(st), 0)
  const bodyWeight = body ? Math.max(1, Math.round(totalMinutes - otherMinutes)) : null

  const weights = trimmedSteps.map((step) => (step === body ? bodyWeight! : width(step)))
  const s = t.plan.structure
  // The caption and the rep label come from the same steps as Today's and
  // Plan's detail line (workoutSummary): a 20 s stride reads "20s", not "1:00".
  const centerCaption = repCaption(trimmedSteps) ?? ''

  return (
    <div>
      <div className="flex items-end" style={{ gap: '3px' }}>
        {trimmedSteps.map((step, i) => {
          const isBody = step === body
          const isWork = step.kind === 'effort' && !isBody
          const share = weights[i]! / totalMinutes
          const labelled = isWork && share >= LABEL_MIN_SHARE

          if (isBody) {
            const bodyLabel = `${formatDurationWords(step.seconds ?? bodyWeight! * 60)}${zoneWord ? ` · ${zoneWord}` : ''}`
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
                height: isWork || bare ? '22px' : '16px',
                background: isWork ? workFill : step.kind === 'recovery' ? RECOVERY_FILL : EASE_FILL,
              }}
            >
              {labelled && (
                <span className="text-caption font-bold leading-none" style={{ color: ZONE_INK }}>
                  {s.min(step.minutes)}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {!bare && (warmup || cooldown || centerCaption) && (
        <div className="mt-1.5 grid grid-cols-3 items-center text-caption" style={{ color: 'var(--subtle-2)' }}>
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
          <span className={row.accent ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{row.label}</span>
          {row.minutes !== null && (
            <span className="shrink-0 tabular-nums text-subtle">{s.min(row.minutes)}</span>
          )}
        </div>
      ))}
    </div>
  )
}
