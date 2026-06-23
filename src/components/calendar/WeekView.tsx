'use client'

import { useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ActivitySheet } from './ActivitySheet'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDateFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TODAY_COLOR = '#f1761f'
const MISSED_COLOR = '#E5396B'

interface Day {
  date: string
  day: number
  acts: Activity[]
}

interface Props {
  weekStart: Date
  byDate: Map<string, Activity[]>
  byDatePlanned: Map<string, PlannedWorkout>
  today: string
}

export function WeekView({ weekStart, byDate, byDatePlanned, today }: Props) {
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = isoDate(addDays(weekStart, i))
    return { date, day: Number(date.slice(8)), acts: byDate.get(date) ?? [] }
  })

  const [selectedDate, setSelectedDate] = useState(
    () => days.find((d) => d.date === today)?.date ?? days[0].date
  )
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null)
  const [sheetPlan, setSheetPlan] = useState<PlannedWorkout | null>(null)

  const selected = days.find((d) => d.date === selectedDate) ?? days[0]
  const selectedPlan = byDatePlanned.get(selected.date)

  return (
    <div className="space-y-3">
      <GlassSurface variant="card" className="rounded-[20px] p-3.5 pb-2.5">
        {/* Weekday labels */}
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

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isToday = d.date === today
            const isPast = d.date < today
            const completed = d.acts.length > 0
            const plan = byDatePlanned.get(d.date)
            const planned = !completed && !!plan
            const missed = isPast && planned
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
                {/* Cell box */}
                <div className="relative flex h-7 w-7 items-center justify-center">
                  {/* Pulse ring for today: opacity-only animation, not scale+fade */}
                  {isToday && !completed && (
                    <div
                      className="absolute inset-0 rounded-[8px] border"
                      style={{
                        borderColor: `${TODAY_COLOR}60`,
                        animation: 'pulse-ring 2s ease-in-out infinite',
                      }}
                    />
                  )}

                  <div
                    className="relative flex h-7 w-7 items-center justify-center rounded-[8px] border transition-colors"
                    style={
                      completed
                        ? { background: 'var(--color-accent, #f1761f)26', borderColor: 'var(--color-accent, #f1761f)4d' }
                        : missed
                          ? { background: `${MISSED_COLOR}1a`, borderColor: `${MISSED_COLOR}40`, opacity: 0.6 }
                          : isToday
                            ? { background: `${TODAY_COLOR}1a`, borderColor: TODAY_COLOR, borderStyle: 'solid' }
                            : planned
                              ? { background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.18)', borderStyle: 'dashed' }
                              : { background: 'rgba(0,0,0,.04)', borderColor: 'rgba(0,0,0,.07)' }
                    }
                  >
                    {completed ? (
                      <Check size={12} strokeWidth={2.5} className="text-accent" />
                    ) : missed ? (
                      <X size={11} strokeWidth={2.5} style={{ color: MISSED_COLOR }} />
                    ) : planned ? (
                      <span
                        className="h-2 w-2 rounded-full border"
                        style={isToday ? { borderColor: TODAY_COLOR } : { borderColor: 'rgba(255,255,255,.35)' }}
                      />
                    ) : isToday ? (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TODAY_COLOR }} />
                    ) : (
                      <span className="text-[11px] text-foreground/20">-</span>
                    )}
                  </div>
                </div>

                {/* Day number */}
                <span
                  className="text-[10px]"
                  style={
                    isToday
                      ? { color: TODAY_COLOR, fontWeight: 700 }
                      : completed
                        ? { color: 'var(--color-foreground)', opacity: 0.7 }
                        : missed
                          ? { color: MISSED_COLOR, opacity: 0.7 }
                          : planned
                            ? { color: 'var(--color-foreground)', opacity: 0.45 }
                            : { color: 'var(--color-foreground)', opacity: 0.25 }
                  }
                >
                  {d.day}
                </span>

                {/* Bottom type bar */}
                <div
                  className="h-[3px] w-[18px] rounded-full"
                  style={{
                    backgroundColor: completed
                      ? ACTIVITY_TYPE_CONFIG[primaryType as ActivityType].dotColor
                      : planned
                        ? isToday
                          ? `${TODAY_COLOR}55`
                          : 'rgba(255,255,255,.12)'
                        : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </GlassSurface>

      {/* Selected day panel */}
      <GlassSurface
        variant="card"
        className={cn('rounded-[20px] p-4', selected.date === today && 'border-accent/30')}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-text">
            {formatDateFull(selected.date)}
          </span>
          {selected.date === today && (
            <span className="text-[11px] font-semibold text-muted-foreground">{t.calendar.today}</span>
          )}
        </div>

        {selected.acts.length > 0 ? (
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
                <ChevronRight size={14} className="shrink-0 text-foreground/30" />
              </button>
            ))}
          </div>
        ) : selectedPlan ? (
          <button
            type="button"
            onClick={() => setSheetPlan(selectedPlan)}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-accent/35 bg-accent/[0.04] p-3 text-left transition-colors hover:bg-accent/[0.07]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1761f" strokeWidth="2.2">
                <path d="M13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-5 6l2-2 2 1 3-2M7 17l2-3 3 1 2-2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {selectedPlan.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {[
                  selectedPlan.scheduledTime,
                  selectedPlan.type ? t.activityTypes[selectedPlan.type as ActivityType] : null,
                  selectedPlan.durationSecs
                    ? `~${Math.round(selectedPlan.durationSecs / 60)} min`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || t.calendar.planned}
              </span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-accent/40" />
          </button>
        ) : (
          <p className="text-sm text-subtle">{t.calendar.restDay}</p>
        )}
      </GlassSurface>

      {sheetActivity && <ActivitySheet activity={sheetActivity} onClose={() => setSheetActivity(null)} />}
      {sheetPlan && <PlannedWorkoutSheet workout={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  )
}
