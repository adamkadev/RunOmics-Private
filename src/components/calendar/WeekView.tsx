'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ActivitySheet } from './ActivitySheet'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// "Today" is its own semantic color, distinct from the accent (= completed):
// it must stay visible whether or not a session lands on the current day.
const TODAY_COLOR = '#f1761f'

interface Day {
  date: string
  day: number
  acts: Activity[]
}

interface Props {
  weekStart: Date
  byDate: Map<string, Activity[]>
  today: string
}

export function WeekView({ weekStart, byDate, today }: Props) {
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = isoDate(addDays(weekStart, i))
    return { date, day: Number(date.slice(8)), acts: byDate.get(date) ?? [] }
  })

  const [selectedDate, setSelectedDate] = useState(
    () => days.find((d) => d.date === today)?.date ?? days[0].date
  )
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null)

  // The selected day tracks the visible week: if the user navigates to another
  // week, fall back to its first day instead of pointing at a date no longer shown.
  const selected = days.find((d) => d.date === selectedDate) ?? days[0]

  return (
    <div className="space-y-3">
      <GlassSurface variant="card" className="rounded-[20px] p-3.5 pb-2.5">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {t.calendar.weekdays.map((label, i) => (
            <div
              key={label}
              className="text-center font-mono text-[9.5px] font-semibold text-muted-foreground/50"
              style={days[i].date === today ? { color: TODAY_COLOR, fontWeight: 700 } : undefined}
            >
              {label[0]}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isToday = d.date === today
            const completed = d.acts.length > 0
            const primaryType: ActivityType | null = completed ? d.acts[0].type : null

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95',
                  d.date === selectedDate && 'bg-foreground/[0.06]'
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-[8px] border',
                    completed && 'border-accent/30 bg-accent-subtle',
                    !completed && !isToday && 'border-foreground/[0.07] bg-foreground/[0.04]',
                    !completed && isToday && 'animate-pulse border-[1.5px]'
                  )}
                  style={
                    !completed && isToday
                      ? { borderColor: TODAY_COLOR, backgroundColor: `${TODAY_COLOR}1f` }
                      : undefined
                  }
                >
                  {completed ? (
                    <Check size={12} strokeWidth={2.5} className="text-accent-text" />
                  ) : isToday ? (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TODAY_COLOR }} />
                  ) : (
                    <span className="text-[11px] text-foreground/20">-</span>
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px]',
                    completed && 'text-foreground/70',
                    !completed && !isToday && 'text-foreground/30',
                    !completed && isToday && 'font-bold'
                  )}
                  style={!completed && isToday ? { color: TODAY_COLOR } : undefined}
                >
                  {d.day}
                </span>

                <div
                  className="h-[3px] w-[18px] rounded-full"
                  style={{
                    backgroundColor: completed ? ACTIVITY_TYPE_CONFIG[primaryType as ActivityType].dotColor : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </GlassSurface>

      <GlassSurface
        variant="card"
        className={cn('rounded-[20px] p-4', selected.date === today && 'border-accent/30')}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-accent-text">
            {formatDate(selected.date)}
          </span>
          {selected.date === today && (
            <span className="text-[11px] font-semibold text-muted-foreground">{t.calendar.today}</span>
          )}
        </div>

        {selected.acts.length === 0 ? (
          <p className="text-sm text-subtle">{t.calendar.restDay}</p>
        ) : (
          <div className="space-y-2">
            {selected.acts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSheetActivity(a)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3 text-left transition-colors hover:bg-foreground/[0.07]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ACTIVITY_TYPE_CONFIG[a.type].dotColor }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {a.description || t.activityTypes[a.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.activityTypes[a.type]} · {a.distanceKm.toFixed(1)} {t.units.km}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </GlassSurface>

      {sheetActivity && <ActivitySheet activity={sheetActivity} onClose={() => setSheetActivity(null)} />}
    </div>
  )
}
