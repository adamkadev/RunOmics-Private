import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { BRAND_TINTS } from '@/lib/colors'
import { t } from '@/i18n'

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

export function RaceFooter({
  race,
  planSpan,
  today,
}: {
  race: UpcomingRace
  planSpan: PlanSpan | null
  today: string
}) {
  const days = Math.max(0, daysBetween(today, race.date))
  const weeks = weeksInPlan(planSpan, today)

  return (
    <div
      className="mt-4 flex items-center justify-between rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      <div className="min-w-0">
        <div className="truncate text-footnote font-semibold text-foreground">{race.name}</div>
        <div className="text-caption text-subtle">
          {race.distance} · {t.plan.raceFooter.inDays(days)}
        </div>
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
