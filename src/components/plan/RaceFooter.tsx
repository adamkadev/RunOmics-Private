import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { BRAND_TINTS } from '@/lib/colors'
import { formatClock, formatDayMonth } from '@/lib/formatters'
import { t } from '@/i18n'

export interface FooterRace {
  race: UpcomingRace
  /** Marks the race the current rolling block runs out to. */
  blockEndsHere?: boolean
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

function raceTitle(race: UpcomingRace): string {
  return race.location && race.location !== race.name ? `${race.name} · ${race.location}` : race.name
}

/**
 * The plan's target races, soonest first. `planSpan` is only supplied when a
 * span really describes progress toward the race (a Garmin plan); a rolling
 * coaching horizon that stops short of the primary target passes none, so no
 * denominator is invented for an event the block does not yet reach.
 */
export function RaceFooter({
  races,
  planSpan,
  weeks: weeksOverride = null,
  today,
}: {
  races: FooterRace[]
  planSpan: PlanSpan | null
  /** Position in the macrocycle toward the primary target, when coaching supplies one. */
  weeks?: { done: number; total: number } | null
  today: string
}) {
  const weeks = weeksOverride ?? weeksInPlan(planSpan, today)
  const ordered = [...races].sort((a, b) => a.race.date.localeCompare(b.race.date))
  if (!ordered.length) return null

  return (
    <div
      className="mt-4 flex items-start justify-between gap-3 rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      <div className="min-w-0 space-y-2">
        {ordered.map(({ race, blockEndsHere }) => (
          <div key={`${race.date}-${race.name}`} className="min-w-0">
            <div className="truncate text-footnote font-semibold text-foreground">{raceTitle(race)}</div>
            <div className="truncate text-caption text-subtle">
              {[formatDayMonth(race.date), race.distance, race.targetSeconds ? formatClock(race.targetSeconds) : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div className="truncate text-micro text-subtle-2">
              {blockEndsHere
                ? t.plan.raceFooter.blockEndsHere
                : t.plan.raceFooter.daysAway(Math.max(0, daysBetween(today, race.date)))}
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
