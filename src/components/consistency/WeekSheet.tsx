'use client'

import { useId, useState, type CSSProperties } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate, formatDateRange, formatDistance, formatDurationWords } from '@/lib/formatters'
import { Sheet as BottomSheet } from '@/components/ui/Sheet'
import { ButtonLink } from '@/components/ui/Button'
import { CrossTrainingList } from '@/components/crossTraining/CrossTraining'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { mondayOf, sheetMonths, shiftMonth, weekSheet, type ConsistencyView, type SheetDay, type SheetRow, type WeekSheet as Sheet } from './consistencyView'

function dayStyle(day: SheetDay): CSSProperties {
  if (day.runs > 0) return { background: 'var(--accent)', color: 'var(--accent-foreground)' }
  // Today already wears a ring: a dashed one under it read as two.
  if (day.planned && day.today) return { background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }
  if (day.planned) return { border: '1.5px dashed var(--accent)' }
  return {}
}

const HIT_TINT = 'color-mix(in srgb, var(--pos) 18%, transparent)'

function RunsChip({ row, target }: { row: SheetRow; target: number }) {
  if (row.status === 'future') return <span />
  const chip = 'justify-self-center whitespace-nowrap rounded-[7px] px-1.5 py-[3px] text-[11px] font-semibold tabular-nums'
  if (row.status === 'hit') {
    return (
      <span className={chip} style={{ background: HIT_TINT }} data-status="hit">
        <span className="inline-flex items-center gap-0.5 text-[var(--pos)]">
          {row.runs}
          <Check size={10} strokeWidth={3} aria-hidden className="shrink-0" />
        </span>
      </span>
    )
  }
  if (row.status === 'current') {
    return <span className={cn(chip, 'border border-[var(--line-2)] text-foreground')} data-status="current">{`${row.runs}/${target}`}</span>
  }
  return <span className={cn(chip, 'bg-[var(--fill-3)] text-muted-foreground')} data-status="under">{`${row.runs}/${target}`}</span>
}

/** "Novembre", not "novembre": it stands alone as a title. */
function monthTitle(month: string): string {
  const name = formatDate(`${month}-01`, { precision: 'month', style: 'full', year: 'auto' })
  return name.charAt(0).toLocaleUpperCase(t.locale) + name.slice(1)
}

/** "Sep 14 – 20" */
function weekRangeLabel(start: string): string {
  return formatDateRange(start, isoDate(addDays(new Date(`${start}T00:00:00`), 6)), { year: 'never' })
}

const MONTH_BUTTON =
  'hit-44 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40'

interface MonthPaging {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  direction: 'forward' | 'backward' | null
}

function Calendar({ sheet, target, paging }: { sheet: Sheet; target: number; paging: MonthPaging }) {
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  const columns = 'grid grid-cols-[repeat(7,minmax(0,1fr))_44px] items-center'
  const s = t.consistency.sheet
  const swipe = useSwipeNavigation(paging.onPrev, paging.onNext, { canPrev: paging.canPrev, canNext: paging.canNext })
  return (
    // A fill, never a card or glass; its corner is concentric with the sheet's (47 - 22).
    <div className="flex flex-col gap-0.5 overflow-hidden rounded-[25px] bg-[var(--fill-4)] px-3 py-2" data-testid="week-calendar" data-month={sheet.month} {...swipe}>
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <button type="button" aria-label={s.prevMonth} onClick={paging.onPrev} disabled={!paging.canPrev} className={MONTH_BUTTON}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="text-[13px] font-semibold text-foreground" aria-live="polite" data-testid="week-calendar-month">
          {monthTitle(sheet.month)}
        </span>
        <button type="button" aria-label={s.nextMonth} onClick={paging.onNext} disabled={!paging.canNext} className={MONTH_BUTTON}>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div
        key={sheet.month}
        className="flex flex-col gap-0.5"
        style={paging.direction ? { animation: `var(--animate-cal-${paging.direction})` } : undefined}
      >
        <div className={cn(columns, 'text-center text-[11px] text-subtle')} aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{narrow.format(new Date(Date.UTC(2024, 0, 1 + i)))}</span>
          ))}
          <span className="flex justify-center">
            <Check size={12} strokeWidth={2.5} aria-hidden />
          </span>
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
    </div>
  )
}

export function WeekSheet({ view, weekStart, today, onClose }: { view: ConsistencyView; weekStart: string; today: string; onClose: () => void }) {
  const s = t.consistency.sheet
  const titleId = useId()
  const [paged, setPaged] = useState<{ month: string; direction: 'forward' | 'backward' } | null>(null)
  const sheet = weekSheet(view, weekStart, today, paged?.month)
  const months = sheetMonths(view, today)

  if (!sheet || !months) return null
  const page = (delta: number) => {
    const month = shiftMonth(sheet.month, delta)
    if (month < months.first || month > months.last) return
    setPaged({ month, direction: delta > 0 ? 'forward' : 'backward' })
  }
  const paging: MonthPaging = {
    onPrev: () => page(-1),
    onNext: () => page(1),
    canPrev: sheet.month > months.first,
    canNext: sheet.month < months.last,
    direction: paged?.direction ?? null,
  }
  const { week } = sheet
  const title = s.title(formatDate(week.start, { style: 'bare' }))
  const hit = sheet.status === 'hit'
  const others = view.others.filter((entry) => mondayOf(entry.date) === week.start)
  const otherSeconds = others.reduce((sum, entry) => sum + entry.durationSeconds, 0)

  const status = hit ? s.hit : sheet.status === 'under' ? s.under : s.current

  return (
    <BottomSheet
      onClose={onClose}
      title={title}
      subtitle={
        <span data-testid="week-summary">
          {s.summary(week.runs, formatDistance(week.km), formatDurationWords(week.seconds))}
          {' · '}
          <span className={cn(hit && 'font-semibold text-[var(--pos)]')} data-testid="week-status">
            {status}
          </span>
        </span>
      }
      titleId={titleId}
      testId="week-sheet"
      bodyClassName="flex flex-col gap-2.5 pt-3"
      footer={
        week.runs > 0 ? (
          <ButtonLink href={`/activities?week=${week.start}`} variant="secondary" size="lg" className="w-full" data-testid="week-activities">
            {s.seeRuns(week.runs)}
          </ButtonLink>
        ) : undefined
      }
    >
      <Calendar sheet={sheet} target={view.target} paging={paging} />
      {others.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1" data-testid="week-cross-training">
          <p className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold text-foreground">{t.crossTraining.title}</span>
            <span className="text-muted-foreground">{t.crossTraining.weekTotal(others.length, formatDurationWords(otherSeconds))}</span>
          </p>
          <CrossTrainingList entries={others} withWeekday />
        </div>
      )}
    </BottomSheet>
  )
}
