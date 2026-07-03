'use client'

import { useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isoWeekNumber } from '@/lib/calendarDate'
import { formatDuration, formatDurationShort } from '@/lib/formatters'
import { AnimatedDuration } from '@/components/ui/AnimatedDuration'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { PeriodNav } from '@/components/ui/PeriodNav'
import { StatusPill } from '@/components/ui/StatusPill'
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
  const today = new Date()
  const isCurrent = currentWeek.weekNumber === isoWeekNumber(today)
  const weekYear = Math.floor(currentWeek.weekNumber / 100)
  const showYear = weekYear !== today.getFullYear()

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => setIndex((i) => Math.min(lastIndex, i + 1))

  const touchStartX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    const SWIPE_THRESHOLD = 40
    if (delta > SWIPE_THRESHOLD) goPrev()
    else if (delta < -SWIPE_THRESHOLD) goNext()
  }

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
    <GlassSurface variant="card" className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between gap-2 border-b border-foreground/[0.08] px-4 py-3">
        <PeriodNav
          label={
            <span className="truncate text-sm font-semibold text-foreground">
              {t.pages.dashboard.weekTitle(currentWeek.weekNumber % 100, showYear ? weekYear : undefined)}
            </span>
          }
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={index === 0}
          nextDisabled={index === lastIndex}
          prevLabel={s.prevWeek}
          nextLabel={s.nextWeek}
          className="min-w-0 justify-center"
        >
          <span>{t.common.sessions(currentWeek.sessionCount)}</span>
        </PeriodNav>
        <div className="flex min-w-28 shrink-0 items-center justify-end">
          {isCurrent && weekLoad
            ? <WeekLoadBadge data={weekLoad} />
            : !isCurrent && (
                <button
                  type="button"
                  onClick={() => setIndex(lastIndex)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
                >
                  {s.jumpToCurrent}
                </button>
              )
          }
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
