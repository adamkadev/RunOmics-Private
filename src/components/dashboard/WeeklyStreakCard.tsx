'use client'

import type { CSSProperties } from 'react'
import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { formatRanKm } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
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

/** The bar area's height; a day's bar is its share of the tallest. */
const BAR_AREA = 84
/** A rest day, or a session the plan gave no km, is this stub. */
const STUB = 8

/**
 * A day's bar (v4.17): planned is a dashed outline over a soft tint of its
 * session's category, done is the accent - the athlete's own km - and
 * missed is the neg outline. Today, still to run, is the 2 px accent outline.
 */
function barStyle(day: WeekStripDay): CSSProperties {
  const height = day.share === null || day.state === 'rest' ? STUB : Math.max(STUB, Math.round(day.share * BAR_AREA))
  if (day.state === 'done') return { height, background: 'var(--accent)' }
  if (day.isToday) return { height, border: '2px solid var(--accent)', background: 'var(--accent-soft)' }
  switch (day.state) {
    case 'planned':
      return { height, border: `1.5px dashed ${day.color}`, background: `color-mix(in srgb, ${day.color} 14%, transparent)` }
    case 'missed':
      return { height, border: '1px solid var(--neg)', background: 'color-mix(in srgb, var(--neg) 25%, transparent)' }
    default:
      return { height, border: '1px solid var(--border)', background: 'var(--surface-2)' }
  }
}

function WeekStrip({ days }: { days: WeekStripDay[] }) {
  return (
    <ul className="flex items-stretch gap-1.5 sm:gap-2.5" data-testid="week-strip">
      {days.map((day) => (
        <li key={day.date} aria-label={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span aria-hidden="true" className="h-4 whitespace-nowrap text-xs font-semibold text-[var(--text-2)]">
            {day.state !== 'rest' && day.kmText !== null ? `${day.kmText} ${t.units.km}` : ''}
          </span>
          <span aria-hidden="true" className="flex w-full items-end" style={{ height: BAR_AREA }}>
            <span className="box-border block w-full rounded-lg" data-state={day.state} data-today={day.isToday ? '' : undefined} style={barStyle(day)} />
          </span>
          <span aria-hidden="true" className={cn('text-xs', day.isToday ? 'font-semibold text-accent-text' : 'text-[var(--text-2)]')}>
            {day.weekday}
          </span>
          <span aria-hidden="true" className="max-w-full truncate text-caption text-muted-foreground">
            {day.kind}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * This week (v4.17): "0 of 51 km · 0 of 5 runs" beside the title, over the
 * seven days as bars of their km, each named by its session. The progress
 * bar under the total is gone - at 0 km it was an empty track saying the
 * same thing as the words. The ring and "5.5 km/day to hit 38" measured a
 * second target (M7).
 */
export function WeeklyStreakCard({ data, target, today: serverToday, sessionKinds = {} }: Props) {
  const s = t.dashboard.weeklyStreak
  const todayIso = useToday(serverToday)
  const targetKm = weeklyTargetKm(target)
  const days = weekStripDays(target.days, todayIso, sessionKinds)

  return (
    <section className={cardClass({ className: 'flex flex-col gap-4' })} data-testid="week-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">{s.title}</h2>
        <p className="text-footnote text-muted-foreground">
          <span className="font-semibold text-foreground">{formatRanKm(target.ranKm)}</span>{' '}
          {targetKm !== null ? s.ofKm(formatWeekKm(targetKm)) : t.units.km}
          {' · '}
          {target.planSessions > 0
            ? s.runsOf(target.plannedDone, target.planSessions)
            : s.weeksInARow(Math.round(data.currentWeeks))}
        </p>
      </div>
      {days.length > 0 && <WeekStrip days={days} />}
    </section>
  )
}
