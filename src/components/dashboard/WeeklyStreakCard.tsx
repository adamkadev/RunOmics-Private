'use client'

import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { formatRanKm } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useToday } from '@/lib/useToday'
import { DayStateStrip } from '@/components/ui/DayStateStrip'
import { dayStateCells } from '@/components/plan/dayStateCells'
import { t } from '@/i18n'

interface Props {
  data: WeeklyStreakData
  /** This week against the plan - the same selector Plan and Activities read. */
  target: WeekTarget
  /** The date the page was prerendered on; see useToday. */
  today: string
}

/**
 * The week in one line, "27.3 of 48 km · 3 of 5 sessions", over its days
 * (M7). The ring and "5.5 km/day to hit 38" measured a second target.
 */
export function WeeklyStreakCard({ data, target, today: serverToday }: Props) {
  const s = t.dashboard.weeklyStreak
  const todayIso = useToday(serverToday)
  const targetKm = weeklyTargetKm(target)

  return (
    // Today's one hero surface (v4.3): the card with a 1.5 px accent border,
    // the week's progress in an accent fill.
    <GlassSurface
      variant="card"
      className="px-4.5 py-3.5"
      data-testid="week-card"
      style={{ border: '1.5px solid var(--acc-line)' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-foreground">
          <span className="font-display text-title2 font-bold tabular-nums">{formatRanKm(target.ranKm)}</span>
          <span className="ml-1 text-footnote text-muted-foreground">
            {targetKm !== null ? s.ofKm(formatWeekKm(targetKm)) : t.units.km}
          </span>
        </p>
        <p className="shrink-0 text-footnote text-muted-foreground">
          {target.planSessions > 0
            ? s.sessionsOf(target.ranSessions, target.planSessions)
            : s.weeksInARow(Math.round(data.currentWeeks))}
        </p>
      </div>

      {targetKm !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--track)]" data-testid="week-progress">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((target.ranKm / targetKm) * 100))}%` }} />
        </div>
      )}

      {/* The same state recipe as Plan's week: done, missed, still to come or
          rest, in the session's intensity; today a solid accent tile. */}
      <div className="mt-3">
        <DayStateStrip variant="dots" days={dayStateCells(target.days, todayIso, 'initial')} />
      </div>
    </GlassSurface>
  )
}
