'use client'

import { useMemo, useState } from 'react'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { NavArrow, TodayButton } from './CalendarNav'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  year: number
  month: number
  byDate: Map<string, Activity[]>
  byDatePlanned: Map<string, PlannedWorkout>
  today: string
  atPresent: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

const WEEKDAYS = t.calendar.weekdays

const MAX_DOTS = 3

function DayActivities({ activities }: { activities: Activity[] }) {
  const visible = activities.slice(0, MAX_DOTS)
  const overflow = activities.length - MAX_DOTS
  const totalKm = activities.reduce((sum, a) => sum + a.distanceKm, 0)
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-[3px]">
        {visible.map((a) => (
          <span
            key={a.id}
            className="inline-block h-[7px] w-[7px] rounded-full shrink-0"
            style={{ background: ACTIVITY_TYPE_CONFIG[a.type].dotColor }}
          />
        ))}
        {overflow > 0 && (
          <span className="text-[9px] font-bold text-muted-foreground leading-none">
            +{overflow}
          </span>
        )}
      </div>
      {totalKm > 0 && (
        <span
          className="text-[10px] font-bold leading-none"
          style={{ color: ACTIVITY_TYPE_CONFIG[activities[0].type].dotColor }}
        >
          {totalKm.toFixed(1)} km
        </span>
      )}
    </div>
  )
}

function PlannedBadge({ workout, onTap }: { workout: PlannedWorkout; onTap: () => void }) {
  const dotColor = workout.type ? ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].dotColor : null
  const label = workout.distanceM
    ? `${round(workout.distanceM / 1000)} ${t.units.km}`
    : workout.durationSecs
      ? `${Math.round(workout.durationSecs / 60)}'`
      : null

  return (
    <button
      type="button"
      onClick={onTap}
      className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-foreground/[0.06]"
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', !dotColor && 'bg-accent/50')}
        style={dotColor ? { background: dotColor, opacity: 0.7 } : undefined}
        aria-hidden="true"
      />
      {label && (
        <span
          className={cn('text-micro font-bold', !dotColor && 'text-accent-text/70')}
          style={dotColor ? { color: dotColor } : undefined}
        >
          {label}
        </span>
      )}
    </button>
  )
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function MonthView({ year, month, byDate, byDatePlanned, today, atPresent, onPrev, onNext, onToday }: Props) {
  const [sheetPlan, setSheetPlan] = useState<PlannedWorkout | null>(null)
  const { cells, totalKm, sessionCount } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prefix = monthKey(year, month)

    const cells: Array<{ day: number; date: string; acts: Activity[] } | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    let totalKm = 0
    let sessionCount = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const acts = byDate.get(date) ?? []
      totalKm += acts.reduce((s, a) => s + a.distanceKm, 0)
      sessionCount += acts.length
      cells.push({ day, date, acts })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    return { cells, totalKm: round(totalKm), sessionCount }
  }, [year, month, byDate])

  return (
    <div className="space-y-3">
      <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
        {!atPresent && (
          <div className="flex justify-end border-b border-foreground/[0.08] px-2 py-1.5">
            <TodayButton onClick={onToday} />
          </div>
        )}
        <div className="flex items-center gap-1.5 p-1.5">
          <NavArrow direction="prev" onClick={onPrev} />
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl">
            <div className="grid grid-cols-7 border-b border-foreground/[0.08]">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-1 py-2 text-center font-mono text-micro font-semibold uppercase tracking-wide text-muted-foreground/60"
                >
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => (
                <div
                  key={i}
                  className={`min-h-16 border-b border-r border-foreground/[0.06] p-1 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                    cell ? '' : 'bg-foreground/[0.02]'
                  }`}
                >
                  {cell && (
                    <>
                      <p
                        className={`mb-1 text-xs ${
                          cell.date === today ? 'font-bold text-accent-text' : 'text-muted-foreground'
                        }`}
                      >
                        {cell.day}
                      </p>
                      {cell.acts.length > 0 ? (
                        <DayActivities activities={cell.acts} />
                      ) : byDatePlanned.has(cell.date) ? (
                        <PlannedBadge
                          workout={byDatePlanned.get(cell.date)!}
                          onTap={() => setSheetPlan(byDatePlanned.get(cell.date)!)}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <NavArrow direction="next" onClick={onNext} disabled={atPresent} />
        </div>
      </GlassSurface>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-subtle">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(ACTIVITY_TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.dotColor }} />
              {t.activityTypes[type as ActivityType]}
            </span>
          ))}
        </div>
        <p className="font-mono">{t.calendar.summary(sessionCount, totalKm)}</p>
      </div>

      {sheetPlan && <PlannedWorkoutSheet workout={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  )
}
