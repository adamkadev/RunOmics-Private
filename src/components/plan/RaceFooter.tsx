import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { BRAND_TINTS } from '@/lib/colors'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

export function RaceFooter({
  race,
  planSpan,
  today,
  supporting = null,
}: {
  race: UpcomingRace
  planSpan: PlanSpan | null
  today: string
  /** A tune-up race on the way to the target; listed alongside it, soonest first. */
  supporting?: UpcomingRace | null
}) {
  const weeks = weeksInPlan(planSpan, today)
  // Both events read as one countdown list, so they run in the order they happen.
  const races = [race, ...(supporting ? [supporting] : [])].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div
      className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      <div className="min-w-0 space-y-1.5">
        {races.map((r) => (
          <div key={`${r.date}-${r.name}`} className="min-w-0">
            <div className="truncate text-footnote font-semibold text-foreground">{r.name}</div>
            <div className="truncate text-caption text-subtle">
              {[r.distance, t.plan.raceFooter.inDays(Math.max(0, daysBetween(today, r.date))), r.targetSeconds ? formatClock(r.targetSeconds) : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        ))}
      </div>
      {weeks && (
        <div className="shrink-0 text-right">
          <div className="font-display text-subhead font-bold text-accent-text">
            {t.plan.raceFooter.weeksIn(weeks.done, weeks.total)}
          </div>
          <div className="text-micro text-subtle-2">{t.plan.raceFooter.weeksInLabel}</div>
        </div>
      )}
    </div>
  )
}
