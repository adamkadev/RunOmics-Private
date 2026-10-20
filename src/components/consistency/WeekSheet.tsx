'use client'

import { useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate, formatDateRange, formatDistance, formatDurationCompact } from '@/lib/formatters'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { weekSheet, type ConsistencyView, type SheetDay, type SheetRow, type WeekSheet as Sheet } from './consistencyView'

/** A day's circle: a run filled in the accent, today ringed, a session to come dashed. */
function dayStyle(day: SheetDay): CSSProperties {
  if (day.runs > 0) return { background: 'var(--accent)', color: 'var(--accent-foreground)' }
  if (day.today) return { border: '2px solid var(--accent)' }
  if (day.planned) return { border: '1.5px dashed var(--accent)' }
  return {}
}

/** The runs column: "5 ✓" on target, the count under it, "0/3" for the week under way, a dash for one to come. */
function RunsChip({ row, target }: { row: SheetRow; target: number }) {
  if (row.status === 'future') return <span className="justify-self-center text-[11px] text-subtle">–</span>
  const chip = 'justify-self-center whitespace-nowrap rounded-[7px] px-1.5 py-[3px] text-[11px] font-semibold tabular-nums'
  if (row.status === 'hit') {
    return (
      <span className={chip} style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }} data-status="hit">
        <span className="text-accent-text">{row.runs} ✓</span>
      </span>
    )
  }
  if (row.status === 'current') {
    return <span className={cn(chip, 'border border-[var(--line-2)] text-foreground')} data-status="current">{`${row.runs}/${target}`}</span>
  }
  return <span className={cn(chip, 'bg-muted text-muted-foreground')} data-status="under">{row.runs}</span>
}

/** "Sep 14 – 20": a calendar row's week, for the reader and the screen reader. */
function weekRangeLabel(start: string): string {
  return formatDateRange(start, isoDate(addDays(new Date(`${start}T00:00:00`), 6)), { year: 'never' })
}

function Calendar({ sheet, target }: { sheet: Sheet; target: number }) {
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  const columns = 'grid grid-cols-[repeat(7,minmax(0,1fr))_44px] items-center'
  return (
    <div className="flex flex-col gap-0.5 rounded-[22px] border border-border bg-card px-3 py-2" data-testid="week-calendar">
      <div className={cn(columns, 'text-center text-[11px] text-subtle')} aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{narrow.format(new Date(Date.UTC(2024, 0, 1 + i)))}</span>
        ))}
        <span>{t.consistency.sheet.runsColumn}</span>
      </div>
      {sheet.rows.map((row) => (
        // Each row says which week it is (App Fixes 3d): the grid of days
        // alone left the highlighted week unnamed.
        <div
          key={row.start}
          className={cn(columns, 'h-9 rounded-xl', row.selected && 'bg-muted')}
          data-testid="calendar-row"
          data-selected={row.selected || undefined}
          aria-label={weekRangeLabel(row.start)}
        >
          {row.days.map((day) => (
            <span key={day.date} className={cn('flex items-center justify-center', !day.inMonth && 'opacity-50')}>
              <span
                className={cn(
                  'box-border flex size-[30px] items-center justify-center rounded-full text-[11.5px] tabular-nums',
                  day.runs > 0 || day.today ? 'font-semibold' : 'text-muted-foreground',
                )}
                style={dayStyle(day)}
                data-runs={day.runs || undefined}
                data-today={day.today || undefined}
                data-planned={day.planned || undefined}
              >
                {day.day}
              </span>
            </span>
          ))}
          <RunsChip row={row} target={target} />
        </div>
      ))}
    </div>
  )
}

/**
 * A tapped week (3.1, mock 6): its runs, km and time, whether it hit three,
 * and the month around it - the week picked out, a run day filled, today
 * ringed, a session to come dashed - with the way to its runs in Activities.
 */
export function WeekSheet({ view, weekStart, today, onClose }: { view: ConsistencyView; weekStart: string; today: string; onClose: () => void }) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  const s = t.consistency.sheet
  const sheet = weekSheet(view, weekStart, today)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  if (!sheet) return null
  const { week } = sheet
  const title = s.title(formatDate(week.start, { style: 'bare' }))
  const hit = sheet.status === 'hit'

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="week-sheet"
    >
      <div className="absolute inset-0 bg-black/45" onClick={close} />
      <div
        ref={trapRef}
        className="relative flex w-full animate-sheet-up flex-col gap-2.5 rounded-t-[28px] border border-border px-4 pt-2 sm:max-w-md sm:rounded-[28px]"
        style={{ background: 'var(--raised)', boxShadow: 'var(--shadow-modal)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', ...sheetStyle }}
      >
        <div className="flex justify-center pb-1" {...handleProps}>
          <div className="h-[5px] w-9 rounded-full" style={{ background: 'var(--muted-foreground)', opacity: 0.5 }} />
        </div>
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-xl font-bold tracking-[-0.01em] text-foreground">{title}</h2>
            <p className="text-[12.5px] text-muted-foreground" data-testid="week-summary">
              {s.summary(week.runs, formatDistance(week.km), formatDurationCompact(week.seconds))}
            </p>
          </div>
          <span
            className={cn('shrink-0 rounded-[10px] px-2.5 py-1 text-xs font-semibold', hit ? 'text-accent-text' : 'bg-muted text-muted-foreground')}
            style={hit ? { background: 'color-mix(in srgb, var(--accent) 18%, transparent)' } : undefined}
            data-testid="week-status"
          >
            {hit ? s.hit : sheet.status === 'under' ? s.under : s.current}
          </span>
        </div>
        <Calendar sheet={sheet} target={view.target} />
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          {week.runs > 0 ? (
            <Link href={`/activities?week=${week.start}`} className="hit-44 text-[13px] font-semibold text-accent-text" data-testid="week-activities">
              {s.seeRuns(week.runs)} ›
            </Link>
          ) : (
            <span />
          )}
          <button type="button" onClick={close} className="hit-44 text-[13px] font-medium text-muted-foreground">
            {s.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
