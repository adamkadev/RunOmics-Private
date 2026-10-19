'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { LEVEL_FILL, STRONG_MONTH_DAYS, TODAY_OUTLINE, dayName, levelStyle, type ConsistencyCell, type ConsistencyMonth, type ConsistencyView, type DayLevel } from './consistencyMonthsView'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { formatDate, formatDecimal, formatDeltaFixed } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const CARD_TITLE = 'text-[15px] font-semibold text-foreground'
/** The day names down the left, every other row (v4.17). */
const DAY_LABEL_ROWS = [0, 2, 4, 6]
/** Under a change this small in runs a week, the year before says nothing new. */
const FLAT_RUNS = 0.1
/** A cell at most 10 px, 3 px apart (3.0): 26 weeks fit a phone, no sideways swipe. */
const CELL_PX = 10

/** The week columns, the day labels then one column a week, each at most a cell wide. */
function columns(weeks: number): CSSProperties {
  return { gridTemplateColumns: `12px repeat(${weeks}, minmax(0, ${CELL_PX}px))`, justifyContent: 'space-between' }
}

function Day({ cell, onRest }: { cell: ConsistencyCell; onRest: (date: string) => void }) {
  const box = 'block aspect-square w-full rounded-[2.5px]'
  if (cell.state === 'none') return <span aria-hidden className={box} />
  const style = levelStyle(cell.level, { today: cell.today, future: cell.state === 'future' })
  const name = dayName(cell)
  if (cell.state === 'run' && cell.activityId) {
    return <Link href={`/activities/${cell.activityId}`} aria-label={name} title={name} className={box} style={style} data-state="run" data-level={cell.level} />
  }
  if (cell.state === 'rest') {
    return <button type="button" aria-label={name} title={name} onClick={() => onRest(cell.date)} className={box} style={style} data-state="rest" />
  }
  return <span aria-hidden title={cell.state === 'future' ? undefined : name} className={box} style={style} data-state={cell.state} data-level={cell.level} />
}

/**
 * The last six months, GitHub-style (v4.17, 3.0): a column a week, Monday
 * on top, each month named over the week that holds its first day. It fits
 * the card's width.
 */
function Calendar({ view, onRest }: { view: ConsistencyView; onRest: (date: string) => void }) {
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  // 2024-01-01 was a Monday.
  const dayLabel = (row: number) => narrow.format(new Date(Date.UTC(2024, 0, 1 + row)))

  return (
    <div data-testid="consistency-calendar">
      <div className="mb-[3px] grid gap-x-[3px] text-[10.5px] text-muted-foreground" style={columns(view.weeks.length)} aria-hidden>
        <span />
        {view.weeks.map((week) => (
          <span key={week.start} data-testid="consistency-month" className="h-4 overflow-visible whitespace-nowrap leading-4">
            {week.monthLabel ?? ''}
          </span>
        ))}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={columns(view.weeks.length)}>
        {Array.from({ length: 7 }, (_, row) => (
          <span key={`label-${row}`} aria-hidden className="flex items-center text-[10.5px] leading-none text-muted-foreground">
            {DAY_LABEL_ROWS.includes(row) ? dayLabel(row) : ''}
          </span>
        ))}
        {view.weeks.flatMap((week) => week.days.map((cell) => <Day key={cell.date} cell={cell} onRest={onRest} />))}
      </div>
    </div>
  )
}

function Swatch({ level }: { level: DayLevel }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[2.5px]" style={{ background: LEVEL_FILL[level] }} />
}

/** 3 px a day (3.0), so a month's bar reads as its count. */
const DAY_PX = 3
/** Room over the tallest bar for its value. */
const VALUE_PX = 16

/**
 * Active days a month (v4.17.1, 3.0): a dashed line at the 16-day target;
 * a month on it or over is the full accent, under it the ramp's lowest tint.
 * The month under way is filled for its days so far, with its projection a
 * dashed box on top. The chart is as tall as its tallest bar, no taller.
 */
function MonthBars({ months }: { months: ConsistencyMonth[] }) {
  const c = t.consistency
  const top = Math.max(STRONG_MONTH_DAYS, ...months.map((m) => m.projected ?? m.activeDays))
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="consistency-counts">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={CARD_TITLE}>{c.perMonth}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{c.target(STRONG_MONTH_DAYS)}</span>
      </div>
      <div className="relative grid grid-cols-12 items-end gap-1.5 sm:gap-2" style={{ height: top * DAY_PX + VALUE_PX }}>
        <span
          aria-hidden
          data-testid="month-target"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground opacity-60"
          style={{ bottom: STRONG_MONTH_DAYS * DAY_PX }}
        />
        {months.map((month) => {
          const ahead = month.projected !== null ? month.projected - month.activeDays : 0
          const strong = (month.projected ?? month.activeDays) >= STRONG_MONTH_DAYS
          return (
            <div
              key={month.key}
              className="flex h-full flex-col items-center justify-end"
              aria-label={month.inProgress ? c.monthSoFar(month.fullLabel, month.activeDays) : c.monthSummary(month.fullLabel, month.activeDays)}
              role="img"
            >
              <span className="mb-1 text-[10.5px] font-semibold leading-none text-foreground" aria-hidden>{month.activeDays}</span>
              {ahead > 0 && (
                <span
                  aria-hidden
                  data-testid="month-projection"
                  className="box-border block w-full rounded-t-[4px] border-[1.5px] border-b-0 border-dashed border-accent"
                  style={{ height: ahead * DAY_PX }}
                />
              )}
              <span
                aria-hidden
                data-testid="month-bar"
                data-strong={strong}
                data-in-progress={month.inProgress || undefined}
                className={cn('block w-full', ahead > 0 ? 'rounded-b-[2px]' : 'rounded-[4px_4px_2px_2px]')}
                style={{ height: month.activeDays * DAY_PX, background: strong ? 'var(--accent)' : LEVEL_FILL[1] }}
              />
            </div>
          )
        })}
      </div>
      <div className="-mt-1.5 grid grid-cols-12 gap-1.5 text-center text-[10.5px] text-muted-foreground sm:gap-2" aria-hidden>
        {months.map((month) => (
          <span key={month.key} className={cn(month.inProgress && 'font-semibold text-accent-text')}>{month.label.charAt(0).toUpperCase()}</span>
        ))}
      </div>
    </section>
  )
}

/**
 * The Consistency page (v4.17, 3.0): active days, runs a week against the
 * year before and the streak; the last six months on the accent ramp; then
 * the active days of each month against the target.
 */
export function ConsistencyMonths({ view }: { view: ConsistencyView }) {
  const c = t.consistency
  const [restDay, setRestDay] = useState<string | null>(null)

  if (view.activeDays === 0) {
    return (
      <section className={cardClass({ dashed: true, className: 'py-10 text-center' })}>
        <p className="text-sm text-subtle">{c.empty}</p>
      </section>
    )
  }

  const prior = view.prior
  // More runs a week is the good direction; fewer is a caution (v4.17).
  const priorTone: StatTone = !prior || Math.abs(prior.delta) < FLAT_RUNS ? 'muted' : prior.delta > 0 ? 'pos' : 'warn'
  const priorLine = prior
    ? prior.fullYear
      ? c.vsLastYear(formatDeltaFixed(prior.delta, 1))
      : c.vsMonths(formatDeltaFixed(prior.delta, 1), prior.months)
    : null

  return (
    <div className="flex flex-col gap-3.5">
      <section className={cardClass()} data-testid="consistency-stats">
        <StatGrid columns={3}>
          {/* The window's dates are the page's subtitle; the stat says what it counts of. */}
          <Stat size="lg" label={c.activeDays} value={view.activeDays} meaning={c.ofDays(view.windowDays)} />
          <Stat
            size="lg"
            label={c.runsPerWeek}
            value={formatDecimal(view.runsPerWeek, 1)}
            // The comparison wraps rather than clipping on a phone.
            meaning={priorLine && <span className="whitespace-normal" data-testid="consistency-prior">{priorLine}</span>}
            tone={priorTone}
          />
          <Stat
            size="lg"
            label={c.streak}
            value={view.streakWeeks}
            unit={c.weeks}
            meaning={view.bestStreakWeeks ? c.best(view.bestStreakWeeks) : null}
          />
        </StatGrid>
      </section>

      <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="consistency-grid">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={CARD_TITLE}>{c.calendarTitle}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">{c.colourKey}</span>
        </div>

        <Calendar view={view} onRest={setRestDay} />

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 pt-1 text-xs text-muted-foreground" data-testid="consistency-legend">
          <span>{c.levels.rest}</span>
          {([0, 1, 2, 3] as const).map((level) => <Swatch key={level} level={level} />)}
          <span>{c.levels.long}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[2.5px]" style={TODAY_OUTLINE} />
            {c.today}
          </span>
          <span aria-live="polite" className={cn('basis-full min-h-4', !restDay && 'sr-only')} data-testid="consistency-rest-day">
            {restDay ? c.restDay(formatDate(restDay)) : null}
          </span>
        </div>
      </section>

      <MonthBars months={view.months} />
    </div>
  )
}
