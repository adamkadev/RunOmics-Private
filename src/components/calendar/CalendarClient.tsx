'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatDayMonth } from '@/lib/formatters'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activities: Activity[]
  plannedWorkouts: PlannedWorkout[]
}

type ViewMode = 'week' | 'month'

export function CalendarClient({ activities, plannedWorkouts }: Props) {
  const now = new Date()
  const today = isoDate(now)
  const [mode, setMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

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

  const swipeProps = useHorizontalSwipe(() => shift(1), () => shift(-1))

  function goToday() {
    setWeekStart(startOfWeek(now))
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  return (
    <div className="space-y-4" {...swipeProps}>
      <GlassSurface as="div" variant="nav" className="top-2 z-20 rounded-2xl px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold leading-[1.1] tracking-tight text-foreground">
              {t.pages.calendar.title}
            </h1>
            <p className="mt-0.5 truncate text-[13px] font-medium text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex shrink-0 gap-0.5 rounded-[10px] border border-foreground/10 bg-foreground/[0.07] p-[3px]">
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  mode === m ? 'bg-foreground/[0.14] text-foreground' : 'text-muted-foreground'
                )}
              >
                {m === 'week' ? t.calendar.switcher.week : t.calendar.switcher.month}
              </button>
            ))}
          </div>
        </div>
      </GlassSurface>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-foreground/[0.12] bg-foreground/[0.08] text-foreground/65 transition-colors hover:bg-foreground/[0.12] active:scale-95"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atPresent}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-foreground/[0.12] bg-foreground/[0.08] text-foreground/65 transition-colors hover:bg-foreground/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
        {!atPresent && (
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
          >
            {t.calendar.today}
          </button>
        )}
      </div>

      <div
        key={animKey}
        className="overflow-hidden"
        style={{ animation: `var(--animate-cal-${direction})` }}
      >
        {mode === 'week' ? (
          <WeekView weekStart={weekStart} byDate={byDate} byDatePlanned={byDatePlanned} today={today} />
        ) : (
          <MonthView year={year} month={month} byDate={byDate} byDatePlanned={byDatePlanned} today={today} />
        )}
      </div>

    </div>
  )
}
