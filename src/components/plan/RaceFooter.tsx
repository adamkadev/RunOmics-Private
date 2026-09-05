import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { BRAND_TINTS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { formatClock, formatDayMonth } from '@/lib/formatters'
import { t } from '@/i18n'

export interface FooterRace {
  race: UpcomingRace
  /** 'primary' is what the macrocycle targets; 'tune_up' is a race on the way. */
  role?: 'primary' | 'tune_up'
  /** Marks the race the current rolling block runs out to. */
  blockEndsHere?: boolean
}

const ROLE_LABEL = { primary: t.plan.raceFooter.primaryTarget, tune_up: t.plan.raceFooter.tuneUp } as const

// "10 km" names a distance, not a race - such an event is known by where it is run.
const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

function raceTitle({ race, role }: FooterRace): string {
  const name = DISTANCE_ONLY.test(race.name) && race.location ? race.location : race.name
  return role ? `${name} · ${ROLE_LABEL[role]}` : name
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
  today,
}: {
  races: FooterRace[]
  planSpan: PlanSpan | null
  today: string
}) {
  // Progress toward the primary target belongs to the macrocycle card; this one
  // keeps only race facts. A Garmin plan span still counts its own weeks here.
  const weeks = weeksInPlan(planSpan, today)
  const ordered = [...races].sort((a, b) => a.race.date.localeCompare(b.race.date))
  if (!ordered.length) return null

  return (
    <div
      data-testid="race-footer"
      className="mt-4 flex items-start justify-between gap-3 rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      {/* Side by side once there is room; stacked on a phone, where two
          columns of race metadata would each be too narrow to read. */}
      <div className={cn('grid min-w-0 flex-1 gap-x-4 gap-y-3', ordered.length > 1 && 'sm:grid-cols-2')}>
        {ordered.map((entry) => {
          const { race, blockEndsHere } = entry
          return (
          <div key={`${race.date}-${race.name}`} className="min-w-0">
            <div className="truncate text-footnote font-semibold text-foreground">{raceTitle(entry)}</div>
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
          )
        })}
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
