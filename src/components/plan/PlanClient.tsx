'use client'

import { useMemo, useState } from 'react'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import type { TrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanSpan } from '@/domain/training/planProgress'
import type { Insight } from '@/lib/gemini'
import { PeriodNav } from '@/components/ui/PeriodNav'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { formatDayMonth } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activities: ActivitySummary[]
  plannedWorkouts: PlannedWorkout[]
  hrBounds?: HrBounds
  statusByDate: TrainingStatusCalendar
  planPhaseRanges: PlanPhaseRange[]
  nextRace: UpcomingRace | null
  /** Athlete pace zones, so a planned session can state its target pace. */
  trainingZones: TrainingZonesData | null
  /** The plan's own start/end, for the week-of-block count. */
  planSpan: PlanSpan | null
  /** Generated line for the week in progress only - past and future weeks keep the banner's own copy. */
  weekPurposeTake: Insight | null
}

type ViewMode = 'week' | 'month'

export function PlanClient({ activities, plannedWorkouts, hrBounds, statusByDate, planPhaseRanges, nextRace, trainingZones, planSpan, weekPurposeTake }: Props) {
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
    const map = new Map<string, ActivitySummary[]>()
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
      ? t.plan.weekOf(formatDayMonth(isoDate(weekStart)))
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
    setDirection(weekStart < startOfWeek(now) ? 'forward' : 'backward')
    setAnimKey((k) => k + 1)
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

  const swipeHandlers = useSwipeNavigation(
    () => shift(-1),
    () => { if (!atPresent) shift(1) }
  )

  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
              {t.pages.plan.title}
            </h1>
            {/* Hidden on mobile - the week/month is changed by swiping there,
                so the label + arrows are redundant. Shown from sm up. */}
            <PeriodNav
              label={<span className="text-footnote font-medium text-muted-foreground">{subtitle}</span>}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
              nextDisabled={atPresent}
              prevLabel={t.plan.prevPeriod}
              nextLabel={t.plan.nextPeriod}
              size="sm"
              className="mt-0.5 hidden sm:flex"
            />
          </div>

          <div
            role="tablist"
            aria-label={t.pages.plan.title}
            className="flex shrink-0 gap-0.5 rounded-full border border-foreground/10 bg-foreground/[0.07] p-[3px]"
          >
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-full px-5 py-1.5 text-caption font-medium transition-colors',
                  mode === m ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                )}
              >
                {m === 'week' ? t.plan.switcher.week : t.plan.switcher.month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        key={animKey}
        className="overflow-hidden"
        style={{ animation: `var(--animate-cal-${direction})` }}
        {...swipeHandlers}
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
            statusByDate={statusByDate}
            planPhaseRanges={planPhaseRanges}
            nextRace={nextRace}
            trainingZones={trainingZones}
            planSpan={planSpan}
            initialSelectedDate={focusDate}
            weekPurposeTake={weekPurposeTake}
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
