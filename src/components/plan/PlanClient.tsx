'use client'

import { useMemo, useState } from 'react'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import type { TrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanSpan } from '@/domain/training/planProgress'
import type { PrescriptionView, CoachingOverview } from '@/application/coaching/GetCoachingView'
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
  trainingZones: TrainingZonesData | null
  planSpan: PlanSpan | null
  coaching: CoachingOverview | null
}

type ViewMode = 'week' | 'month'

export function PlanClient({ activities, plannedWorkouts, hrBounds, statusByDate, planPhaseRanges, nextRace, trainingZones, planSpan, coaching }: Props) {
  const now = new Date()
  const today = isoDate(now)
  const [mode, setMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
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

  const byDateCoach = useMemo(() => {
    const map = new Map<string, PrescriptionView[]>()
    for (const view of coaching?.workouts ?? []) map.set(view.prescription.date, [...(map.get(view.prescription.date) ?? []), view])
    return map
  }, [coaching])

  const canGoForward = coaching
    ? (mode === 'week' ? isoDate(addDays(weekStart, 6)) < coaching.plan.block.endDate : `${year}-${String(month + 1).padStart(2, '0')}` < coaching.plan.block.endDate.slice(0, 7))
    : false

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
    () => { if (!atPresent || canGoForward) shift(1) }
  )

  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
              {t.pages.plan.title}
            </h1>
            <PeriodNav
              label={<span className="text-footnote font-medium text-muted-foreground">{subtitle}</span>}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
              nextDisabled={atPresent && !canGoForward}
              prevLabel={t.plan.prevPeriod}
              nextLabel={t.plan.nextPeriod}
              size="sm"
              className="mt-0.5 hidden sm:flex"
            />
          </div>

          <div
            role="tablist"
            aria-label={t.pages.plan.title}
            className="flex shrink-0 gap-1 rounded-full border border-foreground/10 bg-foreground/[0.07] p-1"
          >
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                  mode === m ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground'
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
            byDateCoach={byDateCoach}
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
            coaching={coaching}
            onSelectDate={setFocusDate}
          />
        ) : (
          <MonthView
            year={year}
            month={month}
            byDate={byDate}
            byDatePlanned={byDatePlanned}
            byDateCoach={byDateCoach}
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
