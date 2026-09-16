import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { BRAND_TINTS } from '@/lib/colors'
import { formatClock, formatCountdown, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

export interface FooterRace {
  race: UpcomingRace
  role?: 'primary' | 'tune_up'
  blockEndsHere?: boolean
}

const ROLE_LABEL = { primary: t.plan.raceFooter.primaryTarget, tune_up: t.plan.raceFooter.tuneUp } as const

const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

function raceTitle({ race, role }: FooterRace): string {
  const name = DISTANCE_ONLY.test(race.name) && race.location ? race.location : race.name
  return role ? `${name} · ${ROLE_LABEL[role]}` : name
}

export function RaceFooter({
  races,
  planSpan,
  today,
}: {
  races: FooterRace[]
  planSpan: PlanSpan | null
  today: string
}) {
  const weeks = weeksInPlan(planSpan, today)
  const ordered = [...races].sort((a, b) => a.race.date.localeCompare(b.race.date))
  if (!ordered.length) return null

  return (
    <div
      data-testid="race-footer"
      className="mt-4 flex items-start justify-between gap-3 rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      <div className="min-w-0 flex-1 divide-y divide-border">
        {ordered.map((entry) => {
          const { race, blockEndsHere } = entry
          return (
            <div
              key={`${race.date}-${race.name}`}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-footnote font-semibold text-foreground">{raceTitle(entry)}</div>
                <div className="truncate text-caption text-subtle">
                  {[formatDate(race.date, { style: 'bare' }), race.distance, race.targetSeconds ? formatClock(race.targetSeconds) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {blockEndsHere && (
                  <div className="truncate text-caption text-muted-foreground">{t.plan.raceFooter.blockEndsHere}</div>
                )}
              </div>
              <div className="shrink-0 font-display text-body font-bold tabular-nums text-foreground">
                {formatCountdown(daysBetween(today, race.date))}
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
