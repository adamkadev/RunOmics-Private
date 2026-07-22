import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { BRAND_TINTS } from '@/lib/colors'
import { t } from '@/i18n'

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000)
}

// Where the whole plan sits relative to race day: weeks elapsed / total, from
// the plan's own first-to-last phase span. Null when there is no dated plan.
function weeksInPlan(ranges: PlanPhaseRange[], today: string): { done: number; total: number } | null {
  if (ranges.length === 0) return null
  const start = ranges[0]!.startDate
  const end = ranges[ranges.length - 1]!.endDate
  const total = Math.max(1, Math.ceil((daysBetween(start, end) + 1) / 7))
  const done = Math.min(total, Math.max(0, Math.ceil((daysBetween(start, today) + 1) / 7)))
  return { done, total }
}

// The race the whole block builds toward - name, distance and countdown, plus
// how far through the plan we are.
export function RaceFooter({
  race,
  ranges,
  today,
}: {
  race: UpcomingRace
  ranges: PlanPhaseRange[]
  today: string
}) {
  const days = Math.max(0, daysBetween(today, race.date))
  const weeks = weeksInPlan(ranges, today)

  return (
    <div
      className="mt-4 flex items-center justify-between rounded-[14px] border border-border px-3.5 py-3.5"
      style={{ background: BRAND_TINTS.footerFill }}
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold text-foreground">{race.name}</div>
        <div className="text-[11px] text-subtle">
          {race.distance} · {t.plan.raceFooter.inDays(days)}
        </div>
      </div>
      {weeks && (
        <div className="shrink-0 text-right">
          <div className="font-display text-[15px] font-bold text-accent-text">
            {t.plan.raceFooter.weeksIn(weeks.done, weeks.total)}
          </div>
          <div className="text-[10px] text-subtle-2">{t.plan.raceFooter.weeksInLabel}</div>
        </div>
      )}
    </div>
  )
}
