import { DAY_MS } from '@/lib/calendarDate'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import { t } from '@/i18n'

const TRACK = 'color-mix(in srgb, var(--foreground) 8%, transparent)'
// "You are here" is the accent. The phases used to wear their own hues, and
// Base's was the fixed emerald that elsewhere means good news.
const PROGRESS = 'var(--accent-text)'

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
    Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS) + 1,
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
          const color = PROGRESS
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
      {/* The phase line above names the current phase (M11): the names stay
          for screen readers, off the screen. */}
      <div className="sr-only">
        {ranges.map((r) => {
          const isPast = r.endDate < weekStart
          const isCurrent = !isPast && r.startDate <= weekEnd
          return (
            <span
              key={r.startDate}
              className="min-w-0 truncate"
              style={{ flex: days(r.startDate, r.endDate), color: isCurrent ? PROGRESS : 'var(--subtle)' }}
            >
              {PHASE_LABEL[r.phase]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
