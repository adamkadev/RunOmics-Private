import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import { TRAINING_PLAN_PHASE_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const TRACK = 'color-mix(in srgb, var(--foreground) 8%, transparent)'

const PHASE_LABEL: Record<TrainingPlanPhase, string> = {
  base: t.plan.phaseTrack.base,
  build: t.plan.phaseTrack.build,
  peak: t.plan.phaseTrack.peak,
  taper: t.plan.phaseTrack.taper,
  raceDay: t.plan.phaseTrack.raceDay,
}

function days(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000) + 1,
  )
}

/**
 * Whether the week reads as "current" for this phase is a question about the
 * whole displayed week, not one reference date - a phase that starts mid-week
 * (say Tuesday) still made the week's own header call that week "Base," so a
 * track anchored to Monday alone disagreed with its own header. A range is
 * current here if it overlaps the week at all; progress reads through to the
 * end of the displayed week, since that's the furthest point this view knows
 * the plan has reached.
 */
export function PlanPhaseTrack({ ranges, weekStart, weekEnd }: { ranges: PlanPhaseRange[]; weekStart: string; weekEnd: string }) {
  if (ranges.length < 2) return null

  return (
    <div className="mt-3.5">
      <div className="flex items-center gap-1">
        {ranges.map((r) => {
          const color = TRAINING_PLAN_PHASE_COLORS[r.phase] ?? 'var(--accent)'
          const isPast = r.endDate < weekStart
          const isCurrent = !isPast && r.startDate <= weekEnd
          const progress = isCurrent
            ? Math.min(100, Math.max(0, (days(r.startDate, weekEnd) / days(r.startDate, r.endDate)) * 100))
            : 0
          const background = isPast
            ? color
            : isCurrent
              ? `linear-gradient(90deg, ${color} ${progress}%, ${TRACK} ${progress}%)`
              : TRACK
          return (
            <div
              key={r.startDate}
              className="h-[5px] rounded-[3px]"
              style={{ flex: days(r.startDate, r.endDate), background }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-micro font-semibold uppercase tracking-[0.04em]">
        {ranges.map((r) => {
          const color = TRAINING_PLAN_PHASE_COLORS[r.phase] ?? 'var(--accent)'
          const isPast = r.endDate < weekStart
          const isCurrent = !isPast && r.startDate <= weekEnd
          return (
            <span
              key={r.startDate}
              style={{ color: isCurrent || isPast ? color : 'var(--subtle)' }}
            >
              {PHASE_LABEL[r.phase]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
