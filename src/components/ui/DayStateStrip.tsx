import type { CSSProperties } from 'react'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { formatDecimal, formatKm } from '@/lib/formatters'

export interface DayStateCell {
  date: string
  /** The column's day name: "M" on Today, "Mon" on Plan. */
  label: string
  fullLabel: string
  state: WeekDayState
  color: string
  /** Planned km on a day still to run, run km on a day run. */
  km: number | null
  isToday: boolean
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

// lib/formatters, not toFixed, so the decimal follows the locale.
function formatCellKm(km: number): string {
  return km < 10 && Math.round(km * 10) % 10 !== 0 ? formatDecimal(km, 1) : formatKm(km)
}

function formatRunKm(km: number): string {
  const tenth = Math.round(km * 10) / 10
  return Number.isInteger(tenth) ? formatKm(tenth) : formatDecimal(tenth, 1)
}

function Dots({ days }: { days: DayStateCell[] }) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 text-center">
      {days.map((cell) => (
        <li key={cell.date} aria-label={cellName(cell)} className="flex flex-col items-center gap-1.25">
          {cell.isToday && cell.state !== 'done' ? (
            <span
              aria-hidden="true"
              data-today-outline
              className="today-bar flex size-8.5 items-center justify-center rounded-control text-caption font-bold tabular-nums text-accent-text"
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
        // A rest day keeps a fixed stub, so it reads as an absence, not the smallest session.
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
              {rest ? '' : cell.km === null ? '–' : cell.state === 'done' ? formatRunKm(cell.km) : formatCellKm(cell.km)}
            </span>
            {cell.isToday && cell.state !== 'done' && !rest ? (
              <span data-today-outline className="today-bar block rounded-lg" style={{ height }} />
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

function DoneSwatch() {
  const bars: { zone: number; height: number }[] = [
    { zone: 2, height: 8 },
    { zone: 4, height: 12 },
    { zone: 2, height: 10 },
  ]
  return (
    <span aria-hidden="true" data-legend-swatch="done" className="flex h-3 items-end gap-px">
      {bars.map((bar, i) => (
        <span
          key={i}
          className="state-done block w-[3px] rounded-[1px]"
          style={{ height: bar.height, '--state-color': `var(--zone-${bar.zone})` } as CSSProperties}
        />
      ))}
    </span>
  )
}

export function DayStateLegend() {
  const muted = { '--state-color': 'var(--muted-foreground)' } as CSSProperties
  const items: { key: string; label: string; className: string; style?: CSSProperties }[] = [
    { key: 'planned', label: t.sessionState.planned, className: 'state-planned rounded-[3px]', style: muted },
    { key: 'missed', label: t.sessionState.missed, className: 'state-missed rounded-[3px]', style: muted },
    { key: 'today', label: t.sessionState.today, className: 'today-bar rounded-[3px]' },
  ]
  return (
    <div data-testid="day-state-legend" className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-caption text-muted-foreground">
      <span className="flex items-center gap-1.25">
        <DoneSwatch />
        {t.sessionState.done}
      </span>
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.25">
          <span aria-hidden="true" data-legend-swatch={item.key} className={cn('block size-3', item.className)} style={item.style} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
