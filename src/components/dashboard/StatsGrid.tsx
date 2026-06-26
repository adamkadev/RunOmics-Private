'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatDurationShort } from '@/lib/formatters'
import { AnimatedDuration } from '@/components/ui/AnimatedDuration'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { Button } from '@/components/ui/Button'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { WeekLoadBadge } from '@/components/dashboard/WeekLoadBadge'
import { t } from '@/i18n'
import type { WeekSummary } from '@/domain/activity/types'
import type { WeeklyLoadComparison } from '@/application/usecases/GetWeeklyLoadComparison'
import type { VO2maxTrend } from '@/application/usecases/GetVO2maxHistory'

interface Props {
  weeks: WeekSummary[]
  currentStreak: number
  vo2max: number | null
  vo2maxTrend: VO2maxTrend | null
  weekLoad: WeeklyLoadComparison | null
}

export function StatsGrid({ weeks, currentStreak, vo2max, vo2maxTrend, weekLoad }: Props) {
  const s = t.dashboard.stats
  const lastIndex = weeks.length - 1
  const [index, setIndex] = useState(lastIndex)
  const currentWeek = weeks[index]
  const isCurrent = index === lastIndex
  const weekYear = Math.floor(currentWeek.weekNumber / 100)
  const showYear = weekYear !== new Date().getFullYear()

  const baseMetrics: Metric[] = [
    {
      value: <AnimatedValue value={currentWeek.totalDistanceKm} decimals={currentWeek.totalDistanceKm >= 10 ? 1 : 2} />,
      unit: currentWeek.totalDistanceKm ? t.units.km : undefined,
      label: s.distance,
    },
    { value: currentWeek.totalDurationSeconds
        ? <AnimatedDuration seconds={currentWeek.totalDurationSeconds} format={formatDurationShort} />
        : formatDurationShort(0),
      unit: currentWeek.totalDurationSeconds ? t.units.hour : undefined,
      label: s.time,
    },
    {
      value: currentWeek.avgPaceSecPerKm
        ? <AnimatedDuration seconds={currentWeek.avgPaceSecPerKm} format={formatDuration} />
        : s.empty,
      unit: currentWeek.avgPaceSecPerKm ? '/' + t.units.km : undefined,
      label: s.avgPace,
    },
    {
      value: currentWeek.avgHeartRate ? <AnimatedValue value={currentWeek.avgHeartRate} /> : s.empty,
      unit: currentWeek.avgHeartRate ? t.units.bpm : undefined,
      label: s.avgHr,
    },
    { value: vo2max !== null
        ? <span className="inline-flex items-baseline gap-0.5">
            <AnimatedValue value={vo2max} />
            {vo2maxTrend === 'up'   && <span className="text-[11px] font-bold text-accent-text">↑</span>}
            {vo2maxTrend === 'down' && <span className="text-[11px] font-bold text-muted-foreground">↓</span>}
          </span>
        : s.empty,
      unit: undefined,
      label: s.vo2max
    },
  ]
  const metrics: Metric[] = currentStreak
    ? [
        ...baseMetrics,
        { value: <AnimatedValue value={currentStreak} />, unit: t.units.day, label: s.streak },
      ]
    : baseMetrics

  return (
    <GlassSurface variant="card" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/[0.08] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-accent-text" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                {t.pages.dashboard.weekTitle(currentWeek.weekNumber % 100, showYear ? weekYear : undefined)}
              </span>
              {isCurrent && weekLoad && <WeekLoadBadge data={weekLoad} />}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t.common.sessions(currentWeek.sessionCount)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isCurrent && (
            <Button variant="ghost" onClick={() => setIndex(lastIndex)} className="px-2 py-1 text-xs">
              {s.jumpToCurrent}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={s.prevWeek}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="h-11 w-11 rounded-md p-0"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="secondary"
            aria-label={s.nextWeek}
            onClick={() => setIndex((i) => Math.min(lastIndex, i + 1))}
            disabled={isCurrent}
            className="h-11 w-11 rounded-md p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <MetricGrid
        metrics={metrics}
        className={cn(
          'px-4 py-4',
          metrics.length <= 5 ? 'grid-cols-5' : 'grid-cols-3 lg:grid-cols-6'
        )}
      />
    </GlassSurface>
  )
}
