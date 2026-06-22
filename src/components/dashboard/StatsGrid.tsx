'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDuration, formatPace } from '@/lib/formatters'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { cardClass } from '@/components/ui/Card'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { WeekLoadBadge } from '@/components/dashboard/WeekLoadBadge'
import { t } from '@/i18n'
import type { WeekSummary } from '@/domain/activity/types'
import type { WeeklyLoadComparison } from '@/application/usecases/GetWeeklyLoadComparison'

interface Props {
  weeks: WeekSummary[]
  currentStreak: number
  vo2max: number | null
  weekLoad: WeeklyLoadComparison | null
}

export function StatsGrid({ weeks, currentStreak, vo2max, weekLoad }: Props) {
  const s = t.dashboard.stats
  const lastIndex = weeks.length - 1
  const [index, setIndex] = useState(lastIndex)
  const currentWeek = weeks[index]
  const isCurrent = index === lastIndex
  const weekYear = Math.floor(currentWeek.weekNumber / 100)
  const showYear = weekYear !== new Date().getFullYear()

  const metrics: Metric[] = [
    {
      value: <AnimatedValue value={currentWeek.totalDistanceKm} decimals={currentWeek.totalDistanceKm >= 10 ? 1 : 2} />,
      unit: 't.units.km',
      label: s.distance,
    },
    { value: formatDuration(currentWeek.totalDurationSeconds), label: s.time },
    {
      value: currentWeek.avgPaceSecPerKm ? formatPace(currentWeek.avgPaceSecPerKm) : s.empty,
      unit: currentWeek.avgPaceSecPerKm ? t.units.minPerKm : undefined,
      label: s.avgPace,
    },
    {
      value: currentWeek.avgHeartRate ? <AnimatedValue value={currentWeek.avgHeartRate} /> : s.empty,
      unit: currentWeek.avgHeartRate ? t.units.bpm : undefined,
      label: s.avgHr,
    },
    { value: <><AnimatedValue value={currentStreak} />d</>, label: s.streak },
    { value: vo2max !== null ? <AnimatedValue value={vo2max} /> : s.empty, label: s.vo2max },
  ]

  return (
    <div className={cardClass({ overflow: true, padding: 'none' })}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3.5">
        <CalendarDays size={14} className="shrink-0 text-accent-text" />
        <span className="text-sm font-semibold text-foreground">
          {t.pages.dashboard.subtitle(currentWeek.weekNumber % 100, currentWeek.sessionCount, showYear ? weekYear : undefined)}
        </span>
        {isCurrent && weekLoad && <WeekLoadBadge data={weekLoad} />}
        <div className="ml-auto flex items-center gap-1">
          {!isCurrent && (
            <button
              onClick={() => setIndex(lastIndex)}
              className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
            >
              {s.jumpToCurrent}
            </button>
          )}
          <button
            aria-label={s.prevWeek}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            aria-label={s.nextWeek}
            onClick={() => setIndex((i) => Math.min(lastIndex, i + 1))}
            disabled={isCurrent}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <MetricGrid metrics={metrics} className="grid-cols-3 px-4 py-4 lg:grid-cols-6" />
    </div>
  )
}
