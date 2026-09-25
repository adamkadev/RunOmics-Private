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
  /** A run that differs from what was planned: the planned intensity, as a cap. */
  plannedColor?: string
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

function DotGlyph({ cell }: { cell: DayStateCell }) {
  if (cell.state === 'done') return <span className="text-zone-ink">✓</span>
  if (cell.state === 'missed') return <span className="text-muted-foreground">×</span>
  if (cell.state === 'planned') {
    return <span className="text-caption text-subtle">{cell.km !== null ? formatCellKm(cell.km) : '–'}</span>
  }
  return <span className="text-caption text-subtle">–</span>
}

function Dots({ days }: { days: DayStateCell[] }) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 text-center">
      {days.map((cell) => (
        <li key={cell.date} aria-label={cellName(cell)} className="flex flex-col items-center gap-1.25">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8.5 items-center justify-center rounded-control text-sm font-bold',
              STATE_CLASS[cell.state],
              cell.isToday && 'state-today',
            )}
            style={stateStyle(cell)}
          >
            <DotGlyph cell={cell} />
          </span>
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
              selected && 'bg-foreground/[0.06]',
            )}
          >
            <span
              className={cn(
                'text-center text-xs font-semibold',
                cell.state === 'missed' ? 'text-delta-warn' : rest ? 'text-subtle' : 'text-foreground',
              )}
            >
              {rest ? t.sessionState.rest.toLowerCase() : cell.km !== null ? formatCellKm(cell.km) : '–'}
            </span>
            <span
              className={cn(
                'relative block overflow-hidden',
                rest ? 'rounded-[3px]' : 'rounded-lg',
                STATE_CLASS[cell.state],
                cell.isToday && 'state-today',
              )}
              style={{ height, ...stateStyle(cell) }}
            >
              {/* Run as something other than what was planned: the fill is what
                  happened, this cap is what was supposed to. */}
              {cell.plannedColor && cell.state === 'done' && (
                <span className="absolute inset-x-0 top-0 block h-0.75" style={{ background: cell.plannedColor }} />
              )}
            </span>
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
