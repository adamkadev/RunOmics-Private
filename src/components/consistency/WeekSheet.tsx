'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate, formatDateRange, formatDistance, formatDurationWords } from '@/lib/formatters'
import { Sheet as BottomSheet } from '@/components/ui/Sheet'
import { CrossTrainingList } from '@/components/crossTraining/CrossTraining'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { mondayOf, weekSheet, type ConsistencyView, type SheetDay, type SheetRow, type WeekSheet as Sheet } from './consistencyView'

function dayStyle(day: SheetDay): CSSProperties {
  if (day.runs > 0) return { background: 'var(--accent)', color: 'var(--accent-foreground)' }
  if (day.planned) return { border: '1.5px dashed var(--accent)' }
  return {}
}

function RunsChip({ row, target }: { row: SheetRow; target: number }) {
  if (row.status === 'future') return <span className="justify-self-center text-[11px] text-subtle">–</span>
  const chip = 'justify-self-center whitespace-nowrap rounded-[7px] px-1.5 py-[3px] text-[11px] font-semibold tabular-nums'
  if (row.status === 'hit') {
    return (
      <span className={chip} style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }} data-status="hit">
        <span className="inline-flex items-center gap-0.5 text-accent-text">
          {row.runs}
          <Check size={10} strokeWidth={3} aria-hidden className="shrink-0" />
        </span>
      </span>
    )
  }
  if (row.status === 'current') {
    return <span className={cn(chip, 'border border-[var(--line-2)] text-foreground')} data-status="current">{`${row.runs}/${target}`}</span>
  }
  return <span className={cn(chip, 'bg-muted text-muted-foreground')} data-status="under">{row.runs}</span>
}

/** "Sep 14 – 20" */
function weekRangeLabel(start: string): string {
  return formatDateRange(start, isoDate(addDays(new Date(`${start}T00:00:00`), 6)), { year: 'never' })
}

function Calendar({ sheet, target }: { sheet: Sheet; target: number }) {
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  const columns = 'grid grid-cols-[repeat(7,minmax(0,1fr))_44px] items-center'
  return (
    // A fill, never a card or glass; its corner is concentric with the sheet's (47 - 22).
    <div className="flex flex-col gap-0.5 rounded-[25px] bg-[var(--fill-4)] px-3 py-2" data-testid="week-calendar">
      <div className={cn(columns, 'text-center text-[11px] text-subtle')} aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{narrow.format(new Date(Date.UTC(2024, 0, 1 + i)))}</span>
        ))}
        <span>{t.consistency.sheet.runsColumn}</span>
      </div>
      {sheet.rows.map((row) => (
        <div
          key={row.start}
          className={cn(columns, 'h-9 rounded-full', row.selected && 'bg-[var(--fill-3)]')}
          data-testid="calendar-row"
          data-selected={row.selected || undefined}
          aria-label={weekRangeLabel(row.start)}
        >
          {row.days.map((day) => (
            <span key={day.date} className={cn('flex items-center justify-center', !day.inMonth && 'opacity-50')}>
              <span
                className={cn(
                  'relative box-border flex size-[30px] items-center justify-center rounded-full text-[11.5px] tabular-nums',
                  day.runs > 0 || day.others > 0 || day.today ? 'font-semibold' : 'text-muted-foreground',
                  day.today && 'state-today',
                )}
                style={dayStyle(day)}
                data-runs={day.runs || undefined}
                data-others={day.others || undefined}
                data-today={day.today || undefined}
                data-planned={day.planned || undefined}
              >
                {day.day}
                {day.others > 0 && (
                  <span
                    aria-hidden
                    className="absolute bottom-[3px] left-1/2 size-[5px] -translate-x-1/2 rounded-full"
                    style={{ background: day.runs > 0 ? 'var(--accent-foreground)' : 'var(--zone-1)' }}
                  />
                )}
              </span>
            </span>
          ))}
          <RunsChip row={row} target={target} />
        </div>
      ))}
    </div>
  )
}

export function WeekSheet({ view, weekStart, today, onClose }: { view: ConsistencyView; weekStart: string; today: string; onClose: () => void }) {
  const s = t.consistency.sheet
  const sheet = weekSheet(view, weekStart, today)

  if (!sheet) return null
  const { week } = sheet
  const title = s.title(formatDate(week.start, { style: 'bare' }))
  const hit = sheet.status === 'hit'
  const others = view.others.filter((entry) => mondayOf(entry.date) === week.start)
  const otherSeconds = others.reduce((sum, entry) => sum + entry.durationSeconds, 0)

  // It draws its own title block and Close; the sheet adds only the glass and the grabber.
  return (
    <BottomSheet onClose={onClose} label={title} showClose={false} testId="week-sheet" bodyClassName="flex flex-col gap-2.5">
      {(close) => (
        <>
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-title-3 text-foreground">{title}</h2>
            <p className="text-[13px] text-muted-foreground" data-testid="week-summary">
              {s.summary(week.runs, formatDistance(week.km), formatDurationWords(week.seconds))}
            </p>
          </div>
          <span
            className={cn('shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold', hit ? 'text-accent-text' : 'bg-[var(--fill-3)] text-muted-foreground')}
            style={hit ? { background: 'color-mix(in srgb, var(--accent) 18%, transparent)' } : undefined}
            data-testid="week-status"
          >
            {hit ? s.hit : sheet.status === 'under' ? s.under : s.current}
          </span>
        </div>
        <Calendar sheet={sheet} target={view.target} />
        {others.length > 0 && (
          <div className="flex flex-col gap-0.5 px-1" data-testid="week-cross-training">
            <p className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold text-foreground">{t.crossTraining.title}</span>
              <span className="text-muted-foreground">{t.crossTraining.weekTotal(others.length, formatDurationWords(otherSeconds))}</span>
            </p>
            <CrossTrainingList entries={others} withWeekday />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          {week.runs > 0 ? (
            <Link href={`/activities?week=${week.start}`} className="hit-44 text-[13px] font-semibold text-accent-text" data-testid="week-activities">
              {s.seeRuns(week.runs)} ›
            </Link>
          ) : (
            <span />
          )}
          <button type="button" onClick={close} className="hit-44 text-[15px] font-medium text-muted-foreground">
            {s.close}
          </button>
        </div>
        </>
      )}
    </BottomSheet>
  )
}
