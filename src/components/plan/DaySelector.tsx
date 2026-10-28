'use client'

import type { WeekDayState } from '@/domain/training/weekTarget'
import type { CrossTrainingKind } from '@/domain/activity/crossTraining'
import { CrossTrainingIcon } from '@/components/crossTraining/CrossTraining'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { formatWeekKm } from './weekPlanDays'

export interface SelectorDay {
  date: string
  state: WeekDayState
  /** Run on a done day, planned otherwise; null for a session planned by time alone. */
  km: number | null
  /** null on a rest day. */
  color: string | null
  text: string | null
  /** "E", "T", "Tm", "L"; null on a rest day. */
  letter: string | null
  isToday: boolean
  /** Each other-training session's kind; none counts toward the day's state or km. */
  other?: CrossTrainingKind[]
}

const PX_PER_KM = 5
const TRACK_PX = 70
const MAX_BAR_PX = 68
/** A session with no distance, or a very short one, still reads as a bar. */
const MIN_BAR_PX = 14
const STUB_PX = 5

export function barHeight(day: Pick<SelectorDay, 'state' | 'km'>): number {
  if (day.state === 'rest') return STUB_PX
  if (day.km === null) return MIN_BAR_PX
  return Math.min(MAX_BAR_PX, Math.max(MIN_BAR_PX, Math.round(day.km * PX_PER_KM)))
}

function dayName(day: SelectorDay): string {
  const state = [t.sessionState[day.state], day.isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
  const km = day.state !== 'rest' && day.km !== null ? `${formatWeekKm(day.km)} ${t.units.km}` : null
  const other = (day.other ?? []).map((kind) => t.crossTraining.kinds[kind])
  return [t.sessionState.dayLabel(formatDate(day.date, { style: 'full' }), state), km, ...other].filter(Boolean).join(' · ')
}

export function DaySelector({
  days,
  selectedDate,
  onSelect,
}: {
  days: SelectorDay[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  // Only a week with other training gives up the room its chips take.
  const withOther = days.some((day) => (day.other?.length ?? 0) > 0)

  return (
    <div role="group" aria-label={t.plan.daySelector} className="grid grid-cols-7 gap-1" data-testid="day-selector">
      {days.map((day, i) => {
        const selected = day.date === selectedDate
        const otherKind = day.other?.[0]
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            aria-label={dayName(day)}
            aria-pressed={selected}
            data-testid={`day-${day.date}`}
            className={cn(
              'flex w-full flex-col items-center gap-1.5 rounded-2xl border-[1.5px] py-2 transition-[background-color,transform] active:scale-95',
              selected && !day.isToday ? 'border-[var(--line-2)] bg-[var(--surface-2)]' : 'border-transparent',
              // The ring drawn inside the column's edge, clear of its neighbours.
              day.isToday && 'state-today [outline-offset:-2px]',
            )}
          >
            <span className="text-xs leading-none text-muted-foreground">{(t.plan.weekdays[i] ?? '').slice(0, 1)}</span>
            <span className={cn('text-lg font-semibold leading-tight tabular-nums', day.isToday ? 'text-accent-text' : 'text-foreground')}>
              {Number(day.date.slice(8))}
            </span>
            <span className="flex items-end" style={{ height: TRACK_PX }}>
              <span
                data-bar-state={day.state}
                className={cn(
                  'box-border block w-5',
                  day.state === 'rest' ? 'rounded-[3px] bg-[var(--rest-bar)]' : 'rounded-[7px]',
                  day.state === 'missed' && 'border-[1.5px] border-dashed border-[var(--warn)]',
                )}
                style={{
                  height: barHeight(day),
                  ...(day.state === 'done' || day.state === 'planned' ? { background: day.color ?? 'var(--line-2)' } : {}),
                }}
              />
            </span>
            <span
              aria-hidden
              className="text-xs font-semibold leading-none tracking-[0.04em]"
              style={{ color: day.letter ? (day.text ?? 'var(--muted-foreground)') : 'var(--muted-foreground)' }}
            >
              {day.letter ?? '–'}
            </span>
            {withOther && (
              <span className="flex h-4 items-center" aria-hidden>
                {otherKind && (
                  <span
                    className="flex h-4 items-center rounded-full px-1.5"
                    style={{ background: 'color-mix(in srgb, var(--zone-1) 16%, transparent)' }}
                    data-testid="day-cross-training"
                  >
                    <CrossTrainingIcon kind={otherKind} size={11} className="text-[var(--zone-1)]" />
                  </span>
                )}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
