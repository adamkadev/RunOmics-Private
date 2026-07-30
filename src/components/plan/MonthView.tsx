'use client'

import { useMemo, useState } from 'react'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDateFull } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { InlineJumpButton } from '@/components/ui/InlineJumpButton'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  year: number
  month: number
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  today: string
  atPresent: boolean
  onToday: () => void
  /** Tap on a day with sessions: jump to the week view with that day selected. */
  onSelectDay: (date: string) => void
}

const WEEKDAYS = t.plan.weekdays

const MAX_DOTS = 3

function DayActivities({ activities }: { activities: ActivitySummary[] }) {
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
            style={{ background: ACTIVITY_TYPE_CONFIG[a.type].chartColor }}
          />
        ))}
        {overflow > 0 && (
          <span className="text-caption font-bold text-muted-foreground leading-none">
            +{overflow}
          </span>
        )}
      </div>
      {totalKm > 0 && activities[0] && (
        <span
          className="text-micro font-bold leading-none"
          style={{ color: ACTIVITY_TYPE_CONFIG[activities[0].type].chartColor }}
        >
          {totalKm.toFixed(1)} {t.units.km}
        </span>
      )}
    </div>
  )
}

// "45'" below the hour mark (matches the day cell's tight width), "1h30" above it.
function formatDurationTickCompact(durationSecs: number): string {
  const totalMin = Math.round(durationSecs / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}${t.units.hour}${String(m).padStart(2, '0')}` : `${m}'`
}

function PlannedBadge({ workout, onTap }: { workout: PlannedWorkout; onTap: () => void }) {
  const dotColor = workout.type ? ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].chartColor : null
  const label = workout.distanceM
    ? `${round(workout.distanceM / 1000)} ${t.units.km}`
    : workout.durationSecs
      ? formatDurationTickCompact(workout.durationSecs)
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

export function MonthView({ year, month, byDate, byDatePlanned, today, atPresent, onToday, onSelectDay }: Props) {
  const [sheetPlan, setSheetPlan] = useState<PlannedWorkout | null>(null)
  const { cells, totalKm, sessionCount } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prefix = monthKey(year, month)

    const cells: Array<{ day: number; date: string; acts: ActivitySummary[] } | null> = []
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
            <InlineJumpButton onClick={onToday}>{t.plan.today}</InlineJumpButton>
          </div>
        )}
        <div className="overflow-hidden rounded-xl">
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
                        <button
                          type="button"
                          onClick={() => onSelectDay(cell.date)}
                          aria-label={formatDateFull(cell.date)}
                          className="-m-1 block w-[calc(100%+8px)] rounded p-1 text-left transition-colors hover:bg-foreground/[0.06]"
                        >
                          <DayActivities activities={cell.acts} />
                        </button>
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
      </GlassSurface>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-subtle">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(ACTIVITY_TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.chartColor }} />
              {t.activityTypes[type as ActivityType]}
            </span>
          ))}
        </div>
        <p className="font-mono">{t.plan.summary(sessionCount, totalKm)}</p>
      </div>

      {sheetPlan && <PlannedWorkoutSheet workout={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  )
}
