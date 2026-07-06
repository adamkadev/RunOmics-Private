'use client'

import { useMemo, useState } from 'react'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { PeriodNav } from '@/components/ui/PeriodNav'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { formatDayMonth } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activities: Activity[]
  plannedWorkouts: PlannedWorkout[]
  hrBounds?: HrBounds
}

type ViewMode = 'week' | 'month'

export function CalendarClient({ activities, plannedWorkouts, hrBounds }: Props) {
  const now = new Date()
  const today = isoDate(now)
  const [mode, setMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  // Set when jumping from a month cell into the week view, so the right day is pre-selected.
  const [focusDate, setFocusDate] = useState<string | null>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of activities) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return map
  }, [activities])

  const byDatePlanned = useMemo(() => {
    const map = new Map<string, PlannedWorkout>()
    for (const p of plannedWorkouts) map.set(p.date, p)
    return map
  }, [plannedWorkouts])

  const atPresent =
    mode === 'week'
      ? isoDate(weekStart) === isoDate(startOfWeek(now))
      : year === now.getFullYear() && month === now.getMonth()

  const subtitle =
    mode === 'week'
      ? t.calendar.weekOf(formatDayMonth(isoDate(weekStart)))
      : new Date(year, month, 1).toLocaleString(t.locale, { month: 'long', year: 'numeric' })

  function shift(delta: number) {
    setFocusDate(null)
    setDirection(delta > 0 ? 'forward' : 'backward')
    setAnimKey((k) => k + 1)
    if (mode === 'week') {
      setWeekStart((prev) => addDays(prev, delta * 7))
    } else {
      const d = new Date(year, month + delta, 1)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
    }
  }

  function goToday() {
    setFocusDate(null)
    setWeekStart(startOfWeek(now))
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  /** Month view day tap: switch to the week view with that day pre-selected. */
  function openWeekAt(date: string) {
    const [y, m, d] = date.split('-').map(Number)
    if (y === undefined || m === undefined || d === undefined) return
    setWeekStart(startOfWeek(new Date(y, m - 1, d)))
    setFocusDate(date)
    setDirection('forward')
    setAnimKey((k) => k + 1)
    setMode('week')
  }

  const { onTouchStart, onTouchEnd } = useSwipeNavigation(
    () => shift(-1),
    () => { if (!atPresent) shift(1) }
  )

  return (
    <div className="space-y-4">
      <GlassSurface as="div" variant="nav" className="rounded-2xl px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-title1 font-extrabold leading-[1.1] tracking-tight text-foreground">
              {t.pages.calendar.title}
            </h1>
            <PeriodNav
              label={<span className="text-footnote font-medium text-muted-foreground">{subtitle}</span>}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
              nextDisabled={atPresent}
              prevLabel={t.calendar.prevPeriod}
              nextLabel={t.calendar.nextPeriod}
              size="sm"
              className="mt-0.5"
            />
          </div>

          <div
            role="tablist"
            aria-label={t.pages.calendar.title}
            className="flex shrink-0 gap-0.5 rounded-control border border-foreground/10 bg-foreground/[0.07] p-[3px]"
          >
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-[7px] px-2.5 py-1 text-caption font-semibold transition-colors',
                  mode === m ? 'bg-foreground/[0.14] text-foreground' : 'text-muted-foreground'
                )}
              >
                {m === 'week' ? t.calendar.switcher.week : t.calendar.switcher.month}
              </button>
            ))}
          </div>
        </div>
      </GlassSurface>

      <div
        key={animKey}
        className="overflow-hidden"
        style={{ animation: `var(--animate-cal-${direction})` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {mode === 'week' ? (
          <WeekView
            weekStart={weekStart}
            activities={activities}
            byDate={byDate}
            byDatePlanned={byDatePlanned}
            hrBounds={hrBounds}
            today={today}
            atPresent={atPresent}
            onToday={goToday}
            initialSelectedDate={focusDate}
          />
        ) : (
          <MonthView
            year={year}
            month={month}
            byDate={byDate}
            byDatePlanned={byDatePlanned}
            today={today}
            atPresent={atPresent}
            onToday={goToday}
            onSelectDay={openWeekAt}
          />
        )}
      </div>

    </div>
  )
}
