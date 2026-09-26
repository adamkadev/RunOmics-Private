import type { CSSProperties } from 'react'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * Seven days, each drawn as its state and its intensity: the shape says done,
 * planned, missed or rest (the .state-* recipes), the colour is the session's
 * zone, and today wears the accent ring. Today's week dots and Plan's week
 * bars used to draw the same week two ways, and Plan drew a missed session as
 * the same solid bar as one still to come.
 */
export interface DayStateCell {
  date: string
  /** The column's day name: "M" on Today, "Mon" on Plan. */
  label: string
  /** The full day, for the cell's accessible name. */
  fullLabel: string
  state: WeekDayState
  /** The session's intensity colour. Ignored on a rest day. */
  color: string
  /** Planned km on a day still to run, run km on a day run. */
  km: number | null
  isToday: boolean
  /** What the day holds, in words, for its accessible name. */
  detail?: string
  testId?: string
}

const STATE_CLASS: Record<WeekDayState, string> = {
  done: 'state-done',
  planned: 'state-planned',
  missed: 'state-missed',
  rest: 'state-rest',
}

function stateStyle(cell: DayStateCell): CSSProperties | undefined {
  return cell.state === 'rest' ? undefined : ({ '--state-color': cell.color } as CSSProperties)
}

function cellName(cell: DayStateCell): string {
  const state = [t.sessionState[cell.state], cell.isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
  return [t.sessionState.dayLabel(cell.fullLabel, state), cell.detail].filter(Boolean).join(' · ')
}

function formatCellKm(km: number): string {
  return km < 10 && Math.round(km * 10) % 10 !== 0 ? km.toFixed(1) : String(Math.round(km))
}

/** A run day's own km, to the tenth: "10.2", not the planned "10" (M11). */
function formatRunKm(km: number): string {
  const tenth = Math.round(km * 10) / 10
  return Number.isInteger(tenth) ? String(tenth) : tenth.toFixed(1)
}

/**
 * Today's week (M7, v4.3): tiles with no glyph, the colour and the shape
 * carry it. Today, still to run, is a solid accent tile with its planned km,
 * so it can't be read as just another day to come.
 */
function Dots({ days }: { days: DayStateCell[] }) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 text-center">
      {days.map((cell) => (
        <li key={cell.date} aria-label={cellName(cell)} className="flex flex-col items-center gap-1.25">
          {cell.isToday && cell.state !== 'done' ? (
            // Today, still to run: a solid accent tile with its km (v4.3 A1).
            <span
              aria-hidden="true"
              data-today-outline
              className="flex size-8.5 items-center justify-center rounded-control bg-accent text-caption font-bold tabular-nums text-accent-foreground"
            >
              {cell.km !== null && cell.state !== 'rest' ? formatCellKm(cell.km) : ''}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={cn('block size-8.5 rounded-control', STATE_CLASS[cell.state], cell.isToday && 'state-today')}
              style={stateStyle(cell)}
            />
          )}
          <span
            aria-hidden="true"
            className={cn('text-caption', cell.isToday ? 'font-bold text-accent-text' : 'font-medium text-subtle')}
          >
            {cell.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

const BAR_MAX = 84

function Bars({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayStateCell[]
  selectedDate?: string
  onSelect?: (date: string) => void
}) {
  const maxKm = Math.max(1, ...days.map((d) => (d.state === 'rest' ? 0 : (d.km ?? 0))))

  return (
    <div className="grid h-33 grid-cols-7 items-end gap-1.5">
      {days.map((cell) => {
        const rest = cell.state === 'rest'
        // The tallest day fills the track; a rest day keeps a fixed stub, so it
        // reads as an absence rather than as the smallest session.
        const height = rest || cell.km === null ? 6 : Math.max(6, Math.round((cell.km / maxKm) * BAR_MAX))
        const selected = cell.date === selectedDate
        return (
          <button
            key={cell.date}
            type="button"
            onClick={() => onSelect?.(cell.date)}
            aria-label={cellName(cell)}
            aria-pressed={selected}
            data-testid={cell.testId}
            className={cn(
              'flex h-full flex-col items-stretch justify-end gap-1 rounded-control px-0.5 pb-0.5 transition-transform active:scale-95',
              selected && !cell.isToday && 'bg-foreground/[0.06]',
            )}
          >
            <span
              className={cn(
                'text-center text-xs font-semibold',
                cell.state === 'missed' ? 'text-delta-warn' : cell.isToday && cell.state !== 'done' ? 'text-accent-text' : 'text-foreground',
              )}
            >
              {/* A rest day is the stub alone (M11). */}
              {rest ? '' : cell.km === null ? '–' : cell.state === 'done' ? formatRunKm(cell.km) : formatCellKm(cell.km)}
            </span>
            {/* Done is the run alone, no planned cap (H19); today still to run
                is a solid accent outline, not the dashed planned one. */}
            {cell.isToday && cell.state !== 'done' && !rest ? (
              <span
                data-today-outline
                className="block rounded-lg border-2 border-accent"
                style={{ height }}
              />
            ) : (
              <span
                className={cn('block', rest ? 'rounded-[3px]' : 'rounded-lg', STATE_CLASS[cell.state], cell.isToday && 'state-today')}
                style={{ height, ...stateStyle(cell) }}
              />
            )}
            <span
              className={cn(
                'text-center text-xs',
                cell.isToday ? 'font-bold text-accent-text' : selected ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {cell.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function DayStateStrip(
  props:
    | { variant: 'dots'; days: DayStateCell[] }
    | { variant: 'bars'; days: DayStateCell[]; selectedDate?: string; onSelect?: (date: string) => void },
) {
  return props.variant === 'dots' ? (
    <Dots days={props.days} />
  ) : (
    <Bars days={props.days} selectedDate={props.selectedDate} onSelect={props.onSelect} />
  )
}

/** The key under Plan's week bars: which shape is which state. Kept at the
 *  owner's request when v4.1 removed the other legends. */
export function DayStateLegend({ color }: { color: string }) {
  const swatch = { '--state-color': color } as CSSProperties
  const items: { key: string; label: string; className: string }[] = [
    { key: 'done', label: t.sessionState.done, className: 'state-done rounded-[3px]' },
    { key: 'planned', label: t.sessionState.planned, className: 'state-planned rounded-[3px]' },
    { key: 'missed', label: t.sessionState.missed, className: 'state-missed rounded-[3px]' },
    { key: 'today', label: t.sessionState.today, className: 'rounded-full border-2 border-accent' },
  ]
  return (
    <div data-testid="day-state-legend" className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-caption text-muted-foreground">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.25">
          <span aria-hidden="true" className={cn('block size-3', item.className)} style={swatch} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
