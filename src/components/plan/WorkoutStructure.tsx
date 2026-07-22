import type { ActivityType, WorkoutStep } from '@/domain/activity/types'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatPaceRange } from '@/lib/formatters'
import { WORKOUT_SEGMENT_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

// SPECS §4: effort yellow / recovery blue, warmup-cooldown muted. Accent-
// independent - step intensity is data, not a theme choice.
const STEP_COLOR: Record<WorkoutStep['kind'], string> = WORKOUT_SEGMENT_COLORS

const STEP_HEIGHT: Record<WorkoutStep['kind'], string> = {
  warmup:   '35%',
  effort:   '100%',
  recovery: '45%',
  cooldown: '35%',
}

/** Mini vertical-bar preview of a parsed workout: width ∝ minutes, height ∝ intensity. */
export function WorkoutStructureBars({ steps, className }: { steps: WorkoutStep[]; className?: string }) {
  return (
    <div className={className ?? 'flex h-[22px] items-end gap-[3px]'} aria-hidden>
      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{
            flexGrow: Math.max(step.minutes, 1),
            flexBasis: 0,
            height: STEP_HEIGHT[step.kind],
            background: STEP_COLOR[step.kind],
          }}
        />
      ))}
    </div>
  )
}

/** Compact step list: warm-up / one summarized interval row / cool-down. */
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
    // A single effort already states its own duration in the label ("85' @
    // pace") - repeating it on the right would just echo the same number.
    // With reps (label is "N × effort'"), the right side adds real info: the
    // block's total duration including recoveries, which the label doesn't sum.
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
