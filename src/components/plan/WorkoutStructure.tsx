import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatPaceRange } from '@/lib/formatters'
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
