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
  /** This week against the plan - the same selector Plan and Activities read. */
  target: WeekTarget
  /** The date the page was prerendered on; see useToday. */
  today: string
  /** Each planned day's session, by date ("Threshold"): see plannedSessionKinds. */
  sessionKinds?: Record<string, string>
}

/**
 * A day's circle (design review, Oct 2026): planned is a dashed ring in its
 * session's category, done is the accent filled - the athlete's own km - and
 * missed the dashed neg ring. Today, still to run, is the 2 px accent ring;
 * a rest day the hairline.
 */
function circleStyle(day: WeekStripDay): CSSProperties {
  if (day.state === 'done') return { background: 'var(--accent)', color: 'var(--accent-foreground)' }
  if (day.isToday) return { border: '2px solid var(--accent)' }
  switch (day.state) {
    case 'planned':
      return { border: `1.5px dashed ${day.color}` }
    case 'missed':
      return { border: '1.5px dashed var(--neg)', color: 'var(--neg)' }
    default:
      return { border: '1px solid var(--border)' }
  }
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
            {day.state !== 'rest' && day.kmText !== null ? day.kmText : ''}
          </span>
          <span aria-hidden="true" className={cn('text-[11px]', day.isToday ? 'font-semibold text-accent-text' : 'text-muted-foreground')}>
            {day.letter}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * This week (design review, Oct 2026): "0 / 54 km · 0 / 5 runs" beside the
 * title, over the seven days as circles, the planned km in each. The bars
 * and their session names repeated Plan's week; the names are now each
 * day's accessible name.
 */
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
