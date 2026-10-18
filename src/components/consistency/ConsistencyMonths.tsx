'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { LEVEL_FILL, STRONG_MONTH_DAYS, TODAY_OUTLINE, dayName, levelStyle, type ConsistencyCell, type ConsistencyMonth, type ConsistencyView, type DayLevel } from './consistencyMonthsView'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { formatDate, formatDelta, formatPercent } from '@/lib/formatters'
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
  // Earlier months off to the left: the grid opens on today, and nothing said
  // the "12 months" of its title were a swipe away (screen audit, Oct 2026).
  const [moreBefore, setMoreBefore] = useState(false)
  const dayLabels = new Intl.DateTimeFormat(t.locale, { weekday: 'short', timeZone: 'UTC' })
  // 2024-01-01 was a Monday.
  const dayLabel = (row: number) => dayLabels.format(new Date(Date.UTC(2024, 0, 1 + row))).replace(/\.$/, '')

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    const update = () => setMoreBefore(el.scrollLeft > 4)
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [])

  return (
    <div className="flex flex-col gap-1.5">
    <div className="relative">
    <div ref={scroller} className="-mr-1 overflow-x-auto pb-1 pr-1 pt-0.5" data-testid="consistency-calendar">
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
      {moreBefore && (
        // A fade just right of the day labels, over the weeks that run on under them.
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[27px] z-20 w-6 bg-gradient-to-r from-card to-transparent" data-testid="consistency-fade" />
      )}
    </div>
      {moreBefore && (
        <span className="text-xs text-muted-foreground" data-testid="consistency-scroll-hint">
          ← {t.consistency.scrollHint}
        </span>
      )}
    </div>
  )
}

function Swatch({ level }: { level: DayLevel }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ background: LEVEL_FILL[level] }} />
}

/** The month under way, as every chart draws a period that is not over: dashed, no verdict. */
const IN_PROGRESS_BORDER = '1.5px dashed var(--accent)'

/**
 * Active days a month (v4.17.1): 16 days or more is the full accent, fewer the
 * ramp's lowest tint. The month under way is dashed and judged neither way:
 * five days into October, its 5 read as a weak month.
 */
function MonthBars({ months }: { months: ConsistencyMonth[] }) {
  const c = t.consistency
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="consistency-counts">
      <h2 className={CARD_TITLE}>{c.perMonth}</h2>
      <div className="grid h-[110px] grid-cols-12 items-end gap-1.5 sm:gap-2">
        {months.map((month) => {
          const strong = !month.inProgress && month.activeDays >= STRONG_MONTH_DAYS
          return (
            <div
              key={month.key}
              className="flex h-full flex-col items-center justify-end gap-1"
              aria-label={month.inProgress ? c.monthSoFar(month.fullLabel, month.activeDays) : c.monthSummary(month.fullLabel, month.activeDays)}
              role="img"
            >
              <span className="text-xs font-semibold text-foreground" aria-hidden>{month.activeDays}</span>
              <span
                aria-hidden
                data-testid="month-bar"
                data-strong={strong}
                data-in-progress={month.inProgress || undefined}
                className="box-border block w-full rounded-[5px_5px_2px_2px]"
                style={{
                  height: `calc((100% - 20px) * ${month.activeDays / 31})`,
                  background: month.inProgress ? 'transparent' : strong ? LEVEL_FILL[3] : LEVEL_FILL[1],
                  border: month.inProgress ? IN_PROGRESS_BORDER : undefined,
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
      <Legend className="border-t border-border pt-2.5">
        <LegendItem swatch="square" color={LEVEL_FILL[3]}>{c.monthLegend.strong(STRONG_MONTH_DAYS)}</LegendItem>
        <LegendItem swatch="square" color={LEVEL_FILL[1]}>{c.monthLegend.fewer}</LegendItem>
        <LegendItem swatch="dashRing" color="var(--accent)">{c.monthLegend.soFar}</LegendItem>
      </Legend>
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
      : c.vsMonths(formatDelta(prior.deltaPts), prior.months)
    : null

  return (
    <div className="flex flex-col gap-3.5">
      <section className={cardClass()} data-testid="consistency-stats">
        <StatGrid columns={3}>
          {/* What the days are counted of (v4.17.2): the twelve months
              from the first of the month, to today - "of 363" read as a
              year that had lost two days. */}
          <Stat size="lg" label={c.activeDays} value={view.activeDays} meaning={c.ofDays(view.windowDays, formatDate(view.windowStart, { style: 'bare', year: 'always' }))} />
          <Stat
            size="lg"
            label={c.share}
            value={formatPercent(view.sharePct)}
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

      <MonthBars months={view.months} />
    </div>
  )
}
