import { DAY_MS } from '@/lib/calendarDate'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const PHASE_LABEL: Record<TrainingPlanPhase, string> = {
  base: t.plan.phaseTrack.base,
  build: t.plan.phaseTrack.build,
  peak: t.plan.phaseTrack.peak,
  taper: t.plan.phaseTrack.taper,
  raceDay: t.plan.phaseTrack.raceDay,
}

// The narrowest a segment draws, so a one-week race phase still holds its
// name on a phone; the rest share the width by their length.
const MIN_SEGMENT = '2.25rem'

function days(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS) + 1,
  )
}

/**
 * The plan's phases as labelled segments sized by their length (v4.17): "Base
 * · 5 wk", "Build · 4 wk". "You are here" is the accent - the current phase's
 * fill and its label - and the phases wear no hues of their own.
 *
 * Whether the week reads as "current" for a phase is a question about the
 * whole displayed week, not one reference date - a phase that starts mid-week
 * (say Tuesday) still made the week's own header call that week "Base," so a
 * track anchored to Monday alone disagreed with its own header. A range is
 * current here if it overlaps the week at all; progress reads through to the
 * end of the displayed week, since that's the furthest point this view knows
 * the plan has reached.
 * When the week spans two phases, the one its header names is current.
 */
export function PlanPhaseTrack({
  ranges,
  weekStart,
  weekEnd,
  phase = null,
}: {
  ranges: PlanPhaseRange[]
  weekStart: string
  weekEnd: string
  /** The phase the week's header names. */
  phase?: TrainingPlanPhase | null
}) {
  if (ranges.length < 2) return null
  const overlaps = (r: PlanPhaseRange) => r.endDate >= weekStart && r.startDate <= weekEnd
  const named = phase !== null && ranges.some((r) => overlaps(r) && r.phase === phase)

  return (
    <div
      data-testid="phase-track"
      className="grid gap-1"
      style={{ gridTemplateColumns: ranges.map((r) => `minmax(${MIN_SEGMENT}, ${days(r.startDate, r.endDate)}fr)`).join(' ') }}
    >
      {ranges.map((r) => {
        const length = days(r.startDate, r.endDate)
        const isPast = r.endDate < weekStart
        const isCurrent = !isPast && r.startDate <= weekEnd && (!named || r.phase === phase)
        const progress = isPast ? 100 : isCurrent ? Math.min(100, Math.max(0, (days(r.startDate, weekEnd) / length) * 100)) : 0
        // A one-week phase is its name alone, as the race week is.
        const weeks = Math.round(length / 7)
        return (
          <div key={r.startDate} className="flex min-w-0 flex-col gap-1.5" data-current={isCurrent ? '' : undefined}>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
            <span className={cn('truncate text-caption', isCurrent ? 'font-semibold text-accent-text' : 'text-muted-foreground')}>
              <span>{PHASE_LABEL[r.phase]}</span>
              {/* The lengths are for the desktop width; on a phone the names alone fit. */}
              {weeks >= 2 && <span className="hidden sm:inline"> · {t.plan.phaseTrack.weeks(weeks)}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
