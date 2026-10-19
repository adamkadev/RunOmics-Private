'use client'

import type { CSSProperties } from 'react'
import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { formatRanKm } from '@/lib/formatters'
import { useToday } from '@/lib/useToday'
import { cn } from '@/lib/utils'
import { weekStripDays, type WeekStripDay } from './weekStrip'
import { t } from '@/i18n'

interface Props {
  data: WeeklyStreakData
  target: WeekTarget
  today: string
  sessionKinds?: Record<string, string>
}

/**
 * A day's circle in Plan's type colours (3.0.2, mock 5f): a session to come
 * dashed in its type's colour, a run done ringed and tinted in the colour of
 * what was run - blue for an easy or long run, purple for threshold - as
 * Plan's day selector fills its bar. Today is the accent ring until run.
 */
function circleStyle(day: WeekStripDay): CSSProperties {
  if (day.state === 'done') return { border: `2px solid ${day.color}`, background: `color-mix(in srgb, ${day.color} 22%, transparent)` }
  if (day.isToday) return { border: '2px solid var(--accent)' }
  switch (day.state) {
    case 'planned':
      return { border: `1.5px dashed ${day.color}` }
    case 'missed':
      return { border: '1.5px dashed var(--neg)', color: 'var(--neg)' }
    default:
      return { background: 'var(--surface-2)', color: 'var(--muted-foreground)' }
  }
}

function circleText(day: WeekStripDay): string {
  if (day.state === 'rest') return '–'
  return day.kmText ?? ''
}

function WeekStrip({ days }: { days: WeekStripDay[] }) {
  return (
    <ul className="flex justify-between gap-1" data-testid="week-strip">
      {days.map((day) => (
        <li key={day.date} aria-label={day.label} className="flex flex-col items-center gap-1.5">
          <span
            aria-hidden="true"
            className="box-border flex size-[34px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums text-foreground"
            data-state={day.state}
            data-today={day.isToday ? '' : undefined}
            style={circleStyle(day)}
          >
            {circleText(day)}
          </span>
          <span aria-hidden="true" className={cn('text-[11px]', day.isToday ? 'font-semibold text-accent-text' : 'text-muted-foreground')}>
            {day.letter}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function WeeklyStreakCard({ data, target, today: serverToday, sessionKinds = {} }: Props) {
  const s = t.dashboard.weeklyStreak
  const todayIso = useToday(serverToday)
  const targetKm = weeklyTargetKm(target)
  const days = weekStripDays(target.days, todayIso, sessionKinds)
  const ran = formatRanKm(target.ranKm)

  return (
    <section className="flex flex-col gap-2.5" data-testid="week-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[13px] font-semibold text-foreground">{s.title}</h2>
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {targetKm !== null ? s.kmOf(ran, formatWeekKm(targetKm)) : `${ran} ${t.units.km}`}
          {' · '}
          {target.planSessions > 0 ? s.runsOf(target.plannedDone, target.planSessions) : s.weeksInARow(Math.round(data.currentWeeks))}
        </p>
      </div>
      {days.length > 0 && <WeekStrip days={days} />}
    </section>
  )
}
