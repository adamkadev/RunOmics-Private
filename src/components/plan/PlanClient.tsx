'use client'

import { useMemo, useState } from 'react'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
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
import { planRace } from './planRace'
import { planPhaseLine, raceCountdown } from './planPhase'

interface Props {
  activities: ActivitySummary[]
  plannedWorkouts: PlannedWorkout[]
  hrBounds?: HrBounds
  planPhaseRanges: PlanPhaseRange[]
  nextRace: UpcomingRace | null
  trainingZones: TrainingZonesData | null
  coaching: PlanCoachingView | null
  /** The date the page was prerendered on; see useToday. */
  today: string
}

type ViewMode = 'week' | 'month'
const VIEW_MODES = ['week', 'month'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function PlanClient({ activities, plannedWorkouts, hrBounds, planPhaseRanges, nextRace, trainingZones, coaching, today: serverToday }: Props) {
  const today = useToday(serverToday)
  const now = new Date(`${today}T00:00:00`)
  const [mode, setMode] = useState<ViewMode>('week')
  const modeTabs = useSegmentedTabs({ ids: VIEW_MODES, value: mode, onChange: setMode })
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // The page hydrates on the date it was built, and the day can roll over
  // after that - at midnight, or because the cached page is from yesterday. A
  // view still on the week or month that was current follows the new one; a
  // view the reader paged to stays put.
  const [shownToday, setShownToday] = useState(today)
  if (shownToday !== today) {
    const was = new Date(`${shownToday}T00:00:00`)
    setShownToday(today)
    if (isoDate(weekStart) === isoDate(startOfWeek(was))) setWeekStart(startOfWeek(now))
    if (year === was.getFullYear() && month === was.getMonth()) {
      setYear(now.getFullYear())
      setMonth(now.getMonth())
    }
  }
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [focusDate, setFocusDate] = useState<string | null>(null)

  // A link to a day - Today's next workout, a missed session - is
  // /plan?date=YYYY-MM-DD: the week view on that day, the day selected. The
  // URL is read after hydration (useUrlParam), so the page stays static.
  const [dateParam] = useUrlParam('date')
  const [shownParam, setShownParam] = useState<string | null>(null)
  if (dateParam !== shownParam) {
    setShownParam(dateParam)
    if (dateParam && ISO_DATE.test(dateParam)) {
      setWeekStart(startOfWeek(new Date(`${dateParam}T00:00:00`)))
      setFocusDate(dateParam)
      setMode('week')
      setAnimKey((k) => k + 1)
    }
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
    ? (mode === 'week' ? isoDate(addDays(weekStart, 6)) < coaching.plan.block.endDate : `${year}-${String(month + 1).padStart(2, '0')}` < coaching.plan.block.endDate.slice(0, 7))
    : false

  const atPresent =
    mode === 'week'
      ? isoDate(weekStart) === isoDate(startOfWeek(now))
      : year === now.getFullYear() && month === now.getMonth()


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

  // Under the title (design review, Oct 2026): where the plan is in the
  // displayed period - "Build · week 9 of 12" - then the race it builds to
  // and how far off it is. No dates: the navigator below names the period.
  const shownDate =
    mode === 'week' ? isoDate(weekStart) : atPresent ? today : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const phaseLine = planPhaseLine(coaching?.plan ?? null, planPhaseRanges, shownDate)
  const race = planRace(coaching, nextRace, today)
  const subtitleRest = [phaseLine?.week, race ? raceCountdown(race, today) : null].filter((part): part is string => !!part)

  return (
    <div className="flex flex-col gap-5">
      {/* Title and subtitle on the left, the switch right-aligned on the
          title's row; on a phone the subtitle takes the full width under both. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:items-end">
        <h1 className="col-start-1 row-start-1 min-w-0 text-display text-foreground">{t.pages.plan.title}</h1>
        {(phaseLine?.phase || subtitleRest.length > 0) && (
          // CompactTitleBar fades the line under the title by its inline
          // opacity, and can write it before this component hydrates.
          <p data-testid="plan-subtitle" className="col-span-2 row-start-2 text-sm text-muted-foreground sm:col-span-1">
            {phaseLine?.phase && <span className="font-semibold text-foreground">{phaseLine.phase}</span>}
            {subtitleRest.map((part, i) => (
              <span key={i}>{i > 0 || phaseLine?.phase ? ` · ${part}` : part}</span>
            ))}
          </p>
        )}
        <div className="col-start-2 row-start-1 sm:row-span-2 sm:self-end">
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
        </div>
      </header>

      <div
        key={animKey}
        {...modeTabs.panelProps}
        className="overflow-hidden"
        style={{ animation: `var(--animate-cal-${direction})` }}
        {...swipeHandlers}
      >
        {mode === 'week' ? (
          <WeekView
            weekStart={weekStart}
            byDate={byDate}
            byDatePlanned={byDatePlanned}
            byDateCoach={byDateCoach}
            hrBounds={hrBounds}
            today={today}
            atPresent={atPresent}
            onToday={goToday}
            onPrevWeek={() => shift(-1)}
            onNextWeek={() => shift(1)}
            canGoForward={canGoForward}
            trainingZones={trainingZones}
            initialSelectedDate={focusDate}
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
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            canGoForward={canGoForward}
          />
        )}
      </div>

    </div>
  )
}
