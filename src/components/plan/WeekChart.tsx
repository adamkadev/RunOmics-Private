'use client'

import type { CSSProperties } from 'react'
import type { DayStateCell } from '@/components/ui/DayStateStrip'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { formatWeekKm } from './weekPlanDays'

/** The tallest day fills the track; a rest day is a fixed stub under it. */
const TRACK_PX = 110
const STUB_PX = 8
/** A session with no distance, or a very short one, still reads as a bar. */
const MIN_BAR_PX = 14

/** A run day's own km to the tenth ("10.2"); a plan's as the week writes it ("10"). */
function kmFigure(cell: DayStateCell): string | null {
  if (cell.state === 'rest' || cell.km === null) return null
  const tenth = Math.round(cell.km * 10) / 10
  return cell.state === 'done' ? formatKm(tenth, Number.isInteger(tenth) ? 0 : 1) : formatWeekKm(cell.km)
}

function cellName(cell: DayStateCell): string {
  const state = [t.sessionState[cell.state], cell.isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
  const figure = kmFigure(cell)
  const km = figure !== null ? `${figure} ${t.units.km}` : null
  const detail = cell.detail && km && cell.detail.includes(km) ? cell.detail : [km, cell.detail].filter(Boolean).join(' · ')
  return [t.sessionState.dayLabel(cell.fullLabel, state), detail].filter(Boolean).join(' · ')
}

/** The figure over a bar, bare: the week's total carries the unit. */
function kmLabel(cell: DayStateCell): string {
  if (cell.state === 'rest') return cell.isToday ? t.plan.restDay : ''
  return kmFigure(cell) ?? '–'
}

/**
 * Each state in its own shape (v4.17): what was run is the accent - it is
 * the athlete's own data - a session still to come is dashed and tinted in
 * its type's zone, a missed one is the negative status, today is the accent
 * outline over its soft fill, and a rest day is a stub.
 */
function barClass(cell: DayStateCell): string {
  if (cell.state === 'done') return 'bg-accent'
  if (cell.isToday) return 'border-2 border-accent bg-[var(--accent-soft)]'
  if (cell.state === 'missed') return 'border-[1.5px] border-dashed border-[var(--neg)] bg-transparent'
  if (cell.state === 'planned') return 'border-[1.5px] border-dashed border-[var(--bar-zone)] bg-[color-mix(in_srgb,var(--bar-zone)_14%,transparent)]'
  return 'border border-border bg-[var(--surface-2)]'
}

/**
 * Plan's week as bars with their km over them, the day under them. A day is
 * a button: it opens that day's session below the chart.
 */
export function WeekChart({
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
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5" data-testid="week-chart">
      {days.map((cell) => {
        const rest = cell.state === 'rest'
        const height = rest ? STUB_PX : cell.km === null ? MIN_BAR_PX : Math.max(MIN_BAR_PX, Math.round((cell.km / maxKm) * TRACK_PX))
        const selected = cell.date === selectedDate && !cell.isToday
        return (
          <button
            key={cell.date}
            type="button"
            onClick={() => onSelect?.(cell.date)}
            aria-label={cellName(cell)}
            aria-pressed={cell.date === selectedDate}
            data-testid={cell.testId}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1.5 rounded-[10px] px-0.5 pb-1 pt-1 transition-[background-color,transform] active:scale-95',
              selected && 'bg-[var(--surface-2)]',
            )}
          >
            <span
              className={cn(
                'h-4 w-full whitespace-nowrap text-center text-[11px] font-semibold leading-4 tabular-nums sm:text-xs',
                cell.state === 'missed' ? 'text-[var(--neg)]' : 'text-[var(--text-2)]',
              )}
            >
              {kmLabel(cell)}
            </span>
            <span className="flex w-full items-end" style={{ height: TRACK_PX }}>
              <span
                data-bar-state={cell.state}
                className={cn('box-border block w-full rounded-lg', barClass(cell))}
                style={{ height, ...(cell.state === 'planned' ? ({ '--bar-zone': cell.color } as CSSProperties) : {}) }}
              />
            </span>
            <span
              className={cn(
                'text-xs',
                cell.isToday ? 'font-semibold text-accent-text' : selected ? 'font-semibold text-foreground' : 'text-[var(--text-2)]',
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

/**
 * The key under the week's bars: one swatch per shape the bars take, on one
 * 11 pt line (design review, Oct 2026: "Planned · colour = session type" ran
 * it onto two; the dashed swatch already says planned).
 */
export function WeekChartLegend() {
  return (
    <div data-testid="day-state-legend">
      <Legend className="flex-nowrap gap-x-3 whitespace-nowrap text-[11px]">
        <LegendItem swatch="square" color="var(--accent)">{t.sessionState.done}</LegendItem>
        <LegendItem swatch="dashRing" color="var(--muted-foreground)">{t.plan.legend.plannedByType}</LegendItem>
        {/* Legend has no tinted or outline-only square: these two are drawn
            here in its 8 px geometry. */}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            data-legend-swatch="missed"
            className="box-border size-2 shrink-0 rounded-[2px] border border-dashed border-[var(--neg)]"
          />
          {t.sessionState.missed}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden data-legend-swatch="today" className="box-border size-2 shrink-0 rounded-[2px] border-[1.5px] border-accent" />
          {t.sessionState.today}
        </span>
      </Legend>
    </div>
  )
}
