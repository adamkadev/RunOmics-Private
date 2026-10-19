'use client'

import type { WeekDayState } from '@/domain/training/weekTarget'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { formatWeekKm } from './weekPlanDays'

export interface SelectorDay {
  date: string
  state: WeekDayState
  /** What was run on a done day, what is planned otherwise; null for a session planned by time alone. */
  km: number | null
  /** The session's colour (sessionKind); null on a rest day. */
  color: string | null
  /** The session's letter under the bar ("E", "T", "Tm", "L"); null on a rest day. */
  letter: string | null
  isToday: boolean
}

/** Each km is 3.2 px of bar (redesign 3.0, 1d), up to the tallest a phone row holds. */
const PX_PER_KM = 3.2
const MAX_BAR_PX = 96
/** A session with no distance, or a very short one, still reads as a bar. */
const MIN_BAR_PX = 14
const STUB_PX = 4

export function barHeight(day: Pick<SelectorDay, 'state' | 'km'>): number {
  if (day.state === 'rest') return STUB_PX
  if (day.km === null) return MIN_BAR_PX
  return Math.min(MAX_BAR_PX, Math.max(MIN_BAR_PX, Math.round(day.km * PX_PER_KM)))
}

function dayName(day: SelectorDay): string {
  const state = [t.sessionState[day.state], day.isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
  const km = day.state !== 'rest' && day.km !== null ? `${formatWeekKm(day.km)} ${t.units.km}` : null
  return [t.sessionState.dayLabel(formatDate(day.date, { style: 'full' }), state), km].filter(Boolean).join(' · ')
}

/**
 * The week as seven days (redesign 3.0, 1d): the day's letter, its date, and
 * a bar as long as its km in its session's colour - a rest day a stub, a
 * missed session an outline in the negative status. Selecting a day shows
 * its workout under the selector; today wears the accent.
 */
export function DaySelector({
  days,
  selectedDate,
  onSelect,
}: {
  days: SelectorDay[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const track = Math.max(20, ...days.map(barHeight))

  return (
    <div role="group" aria-label={t.plan.daySelector} className="grid grid-cols-7 gap-1" data-testid="day-selector">
      {days.map((day, i) => {
        const selected = day.date === selectedDate
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            aria-label={dayName(day)}
            aria-pressed={selected}
            data-testid={`day-${day.date}`}
            className={cn(
              'mx-auto flex w-full max-w-[44px] flex-col items-center gap-1 rounded-2xl border py-2 transition-[background-color,transform] active:scale-95',
              selected ? 'border-[var(--line-2)] bg-[var(--surface-2)]' : 'border-transparent',
              day.isToday && 'border-accent',
            )}
          >
            <span className="text-[11px] leading-none text-muted-foreground">{(t.plan.weekdays[i] ?? '').slice(0, 1)}</span>
            <span className={cn('text-base font-semibold leading-tight tabular-nums', day.isToday ? 'text-accent-text' : 'text-foreground')}>
              {Number(day.date.slice(8))}
            </span>
            <span className="mt-1 flex items-end" style={{ height: track }}>
              <span
                data-bar-state={day.state}
                className={cn(
                  'box-border block w-3.5 rounded-[5px]',
                  day.state === 'rest' && 'bg-[var(--line-2)]',
                  day.state === 'missed' && 'border-[1.5px] border-dashed border-[var(--neg)]',
                )}
                style={{
                  height: barHeight(day),
                  ...(day.state === 'done' || day.state === 'planned' ? { background: day.color ?? 'var(--line-2)' } : {}),
                }}
              />
            </span>
            <span
              aria-hidden
              className="text-[11px] font-semibold leading-none tracking-[0.04em]"
              style={{ color: day.letter ? (day.color ?? 'var(--muted-foreground)') : 'var(--muted-foreground)' }}
            >
              {day.letter ?? '–'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
