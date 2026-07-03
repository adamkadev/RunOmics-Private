'use client'

import { useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isoWeekNumber } from '@/lib/calendarDate'
import { formatDuration, formatDurationShort } from '@/lib/formatters'
import { AnimatedDuration } from '@/components/ui/AnimatedDuration'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { Button } from '@/components/ui/Button'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
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
  const isCurrent = index === lastIndex
  const weekYear = Math.floor(currentWeek.weekNumber / 100)
  const showYear = weekYear !== new Date().getFullYear()

  const today = new Date()
  const dayOfWeek = today.getDay() || 7
  const isInProgress = isCurrent && currentWeek.weekNumber === isoWeekNumber(today) && dayOfWeek < 7

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
        <CalendarDays size={16} className="shrink-0 text-accent-text" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={s.prevWeek}
            onClick={goPrev}
            disabled={index === 0}
            className="h-11 w-11 shrink-0 rounded-md p-0"
          >
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {t.pages.dashboard.weekTitle(currentWeek.weekNumber % 100, showYear ? weekYear : undefined)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span>{t.common.sessions(currentWeek.sessionCount)}</span>
              {isInProgress && (
                <StatusPill tone="blue">{s.inProgress(dayOfWeek)}</StatusPill>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            aria-label={s.nextWeek}
            onClick={goNext}
            disabled={isCurrent}
            className="h-11 w-11 shrink-0 rounded-md p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="shrink-0">
          {isCurrent && weekLoad
            ? <WeekLoadBadge data={weekLoad} />
            : !isCurrent && (
                <Button variant="ghost" onClick={() => setIndex(lastIndex)} className="px-2 py-1 text-xs">
                  {s.jumpToCurrent}
                </Button>
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
