'use client'

import { useMemo, useState } from 'react'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { useToday } from '@/lib/useToday'
import { useUrlParam } from '@/lib/useUrlParam'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { t } from '@/i18n'

interface Props {
  activities: ActivitySummary[]
  plannedWorkouts: PlannedWorkout[]
  planPhaseRanges: PlanPhaseRange[]
  nextRace: UpcomingRace | null
  trainingZones: TrainingZonesData | null
  coaching: PlanCoachingView | null
  /** The date the page was prerendered on; see useToday. */
  today: string
}

type ViewMode = 'week' | 'month'
const VIEW_MODES = ['week', 'month'] as const

/** A `?date=` worth reading: a real calendar day, "2026-10-21". */
export function planDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return isoDate(new Date(`${value}T00:00:00`)) === value ? value : null
}

const monthKeyOf = (date: string) => date.slice(0, 7)

/**
 * Plan (redesign 3.0): the week or the month, and the day selected in it.
 * Both live in the URL - `?view=month`, `?date=2026-10-21` - so Today's next
 * workout opens straight onto its day, and a reload keeps the place. No date
 * is today, and follows it over midnight; no view is the week.
 */
export function PlanClient({ activities, plannedWorkouts, planPhaseRanges, nextRace, trainingZones, coaching, today: serverToday }: Props) {
  const today = useToday(serverToday)
  const [viewParam, setViewParam] = useUrlParam('view')
  const [dateParam, setDateParam] = useUrlParam('date')
  const mode: ViewMode = viewParam === 'month' ? 'month' : 'week'
  const selectedDate = planDateParam(dateParam) ?? today
  const weekStart = useMemo(() => startOfWeek(new Date(`${selectedDate}T00:00:00`)), [selectedDate])
  // The month paged to, apart from the selected day; null is the selected day's month.
  const [pagedMonth, setPagedMonth] = useState<string | null>(null)
  const monthKey = pagedMonth ?? monthKeyOf(selectedDate)
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7)) - 1
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

  function setMode(next: ViewMode) {
    setPagedMonth(null)
    setViewParam(next === 'week' ? null : next)
  }
  const modeTabs = useSegmentedTabs({ ids: VIEW_MODES, value: mode, onChange: setMode })

  function selectDate(date: string) {
    setDateParam(date === today ? null : date)
  }

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
    const map = new Map<string, PlanPrescriptionView[]>()
    for (const view of coaching?.workouts ?? []) map.set(view.prescription.date, [...(map.get(view.prescription.date) ?? []), view])
    return map
  }, [coaching])

  const canGoForward = coaching
    ? (mode === 'week' ? isoDate(addDays(weekStart, 6)) < coaching.plan.block.endDate : monthKey < coaching.plan.block.endDate.slice(0, 7))
    : false

  const thisWeek = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  const atPresent = mode === 'week' ? isoDate(weekStart) === thisWeek : monthKey === monthKeyOf(today)

  function shift(delta: number) {
    setDirection(delta > 0 ? 'forward' : 'backward')
    if (mode === 'week') {
      // The same weekday a week on, or today when the week it lands on holds it.
      const monday = isoDate(addDays(weekStart, delta * 7))
      const next = isoDate(addDays(new Date(`${selectedDate}T00:00:00`), delta * 7))
      selectDate(monday === thisWeek ? today : next)
    } else {
      const d = new Date(year, month + delta, 1)
      setPagedMonth(monthKeyOf(isoDate(d)))
    }
  }

  function goToday() {
    setDirection(selectedDate < today ? 'forward' : 'backward')
    setPagedMonth(null)
    setDateParam(null)
  }

  /** A month's day, or its week: the Week view, on that day. */
  function openWeekAt(date: string) {
    setDirection('forward')
    setPagedMonth(null)
    selectDate(date)
    setViewParam(null)
  }

  const swipeHandlers = useSwipeNavigation(
    () => shift(-1),
    () => { if (!atPresent || canGoForward) shift(1) }
  )

  return (
    <div className="flex flex-col gap-5">
      {/* The title and the switch on one row (redesign 3.0): the phase card
          names the race, so the header carries no subtitle. */}
      <header className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 text-display text-foreground">{t.pages.plan.title}</h1>
        <SegmentedTabs
          tabs={modeTabs}
          items={[
            { id: 'week', label: t.plan.switcher.week },
            { id: 'month', label: t.plan.switcher.month },
          ]}
          label={t.pages.plan.title}
          size="sm"
          tabClassName="px-3.5 text-[13px]"
        />
      </header>

      <div
        key={mode === 'week' ? `week:${isoDate(weekStart)}` : `month:${monthKey}`}
        {...modeTabs.panelProps}
        className="overflow-hidden"
        style={{ animation: `var(--animate-cal-${direction})` }}
        {...swipeHandlers}
      >
        {mode === 'week' ? (
          <WeekView
            weekStart={weekStart}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            byDate={byDate}
            byDatePlanned={byDatePlanned}
            byDateCoach={byDateCoach}
            today={today}
            atPresent={atPresent}
            onToday={goToday}
            onPrevWeek={() => shift(-1)}
            onNextWeek={() => shift(1)}
            canGoForward={canGoForward}
            planPhaseRanges={planPhaseRanges}
            nextRace={nextRace}
            trainingZones={trainingZones}
            coaching={coaching}
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
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            canGoForward={canGoForward}
          />
        )}
      </div>
    </div>
  )
}
