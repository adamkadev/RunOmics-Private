'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { LEVEL_FILL, TODAY_OUTLINE, dayName, levelStyle, type ConsistencyCell, type ConsistencyMonth, type ConsistencyView, type DayLevel } from './consistencyMonths'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { formatDate, formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const CARD_TITLE = 'text-[15px] font-semibold text-foreground'
/** The day names down the left, every other row (v4.17). */
const DAY_LABEL_ROWS = [0, 2, 4, 6]
/** The day labels stay put while the weeks scroll under them, the gap covered too. */
const STICKY = 'sticky left-0 z-10 bg-card shadow-[4px_0_0_var(--card)]'
/** Under a share-point change this small, the year before says nothing new. */
const FLAT_PTS = 2

/** The week columns, 24 pt of day labels then one column a week. */
function columns(weeks: number): CSSProperties {
  return { gridTemplateColumns: `24px repeat(${weeks}, minmax(0, 1fr))` }
}

function Day({ cell, onRest }: { cell: ConsistencyCell; onRest: (date: string) => void }) {
  const box = 'block aspect-square w-full rounded-[3px]'
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
 * Every day of the rolling year, GitHub-style (v4.17): a column a week,
 * Monday on top, the months named over the columns they start. On a phone
 * the grid keeps a legible cell and scrolls sideways, opened on today.
 */
function YearCalendar({ view, onRest }: { view: ConsistencyView; onRest: (date: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const dayLabels = new Intl.DateTimeFormat(t.locale, { weekday: 'short', timeZone: 'UTC' })
  // 2024-01-01 was a Monday.
  const dayLabel = (row: number) => dayLabels.format(new Date(Date.UTC(2024, 0, 1 + row))).replace(/\.$/, '')

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1" data-testid="consistency-calendar">
      <div className="min-w-[700px]">
        <div className="mb-[3px] grid gap-x-[3px] text-caption text-muted-foreground" style={columns(view.weeks.length)} aria-hidden>
          <span className={STICKY} />
          {view.weeks.map((week) => (
            <span key={week.start} data-testid="consistency-month" className="h-4 overflow-visible whitespace-nowrap leading-4">
              {week.monthLabel ?? ''}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={columns(view.weeks.length)}>
          {Array.from({ length: 7 }, (_, row) => (
            <span key={`label-${row}`} aria-hidden className={cn(STICKY, 'flex items-center text-caption leading-none text-muted-foreground')}>
              {DAY_LABEL_ROWS.includes(row) ? dayLabel(row) : ''}
            </span>
          ))}
          {view.weeks.flatMap((week) => week.days.map((cell) => <Day key={cell.date} cell={cell} onRest={onRest} />))}
        </div>
      </div>
    </div>
  )
}

function Swatch({ level }: { level: DayLevel }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ background: LEVEL_FILL[level] }} />
}

/** Active days a month; a month at or above the year's share is the full accent. */
function MonthBars({ months, sharePct }: { months: ConsistencyMonth[]; sharePct: number }) {
  const c = t.consistency
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="consistency-counts">
      <h2 className={CARD_TITLE}>{c.perMonth}</h2>
      <div className="grid h-[110px] grid-cols-12 items-end gap-1.5 sm:gap-2">
        {months.map((month) => {
          const strong = month.days > 0 && (month.activeDays / month.days) * 100 >= sharePct
          return (
            <div key={month.key} className="flex h-full flex-col items-center justify-end gap-1" aria-label={c.monthSummary(month.fullLabel, month.activeDays)} role="img">
              <span className="text-xs font-semibold text-foreground" aria-hidden>{month.activeDays}</span>
              <span
                aria-hidden
                data-testid="month-bar"
                data-strong={strong}
                className="block w-full rounded-[5px_5px_2px_2px]"
                style={{
                  height: `calc((100% - 20px) * ${month.activeDays / 31})`,
                  background: strong ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 40%, transparent)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-12 gap-1.5 text-center text-[11px] text-muted-foreground sm:gap-2" aria-hidden>
        {months.map((month) => (
          <span key={month.key} className="whitespace-nowrap">{month.label}</span>
        ))}
      </div>
    </section>
  )
}

/**
 * The Consistency page (v4.17): active days, their share against the year
 * before and the streak; every day of the rolling year on the accent ramp;
 * then the active days of each month.
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
  // More of the days run is the good direction; fewer is a caution (v4.17).
  const priorTone: StatTone = !prior || Math.abs(prior.deltaPts) < FLAT_PTS ? 'muted' : prior.deltaPts > 0 ? 'pos' : 'warn'
  const priorLine = prior
    ? prior.fullYear
      ? c.vsPrior(formatDelta(prior.deltaPts))
      : c.vsRange(formatDelta(prior.deltaPts), prior.range)
    : null

  return (
    <div className="flex flex-col gap-3.5">
      <section className={cardClass()} data-testid="consistency-stats">
        <StatGrid columns={3}>
          <Stat size="lg" label={c.activeDays} value={view.activeDays} meaning={c.ofDays(view.windowDays)} />
          <Stat
            size="lg"
            label={c.share}
            value={`${view.sharePct}%`}
            // The comparison wraps rather than clipping on a phone.
            meaning={priorLine && <span className="whitespace-normal" data-testid="consistency-prior">{priorLine}</span>}
            tone={priorTone}
          />
          <Stat
            size="lg"
            label={c.streak}
            value={view.streakWeeks}
            unit={c.weeks(view.streakWeeks)}
            meaning={view.bestStreakWeeks ? c.best(view.bestStreakWeeks) : null}
          />
        </StatGrid>
      </section>

      <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="consistency-grid">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={CARD_TITLE}>{c.calendarTitle}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">{c.colourKey}</span>
        </div>

        <YearCalendar view={view} onRest={setRestDay} />

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 pt-1 text-xs text-muted-foreground" data-testid="consistency-legend">
          <span>{c.levels.rest}</span>
          {([0, 1, 2, 3] as const).map((level) => <Swatch key={level} level={level} />)}
          <span>{c.levels.long}</span>
          <span className="ml-3.5 flex items-center gap-1.5">
            <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={TODAY_OUTLINE} />
            {c.today}
          </span>
          <span aria-live="polite" className={cn('ml-auto min-h-4', !restDay && 'sr-only')} data-testid="consistency-rest-day">
            {restDay ? c.restDay(formatDate(restDay)) : null}
          </span>
        </div>
      </section>

      <MonthBars months={view.months} sharePct={view.sharePct} />
    </div>
  )
}
