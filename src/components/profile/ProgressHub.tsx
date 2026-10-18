import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { Stat, StatGrid, Unit } from '@/components/ui/Stat'
import { formatDate, formatDelta, formatDuration, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import type { WearStatus } from '@/domain/shoe/wearStatus'
import type { HeatCell, ProgressHubView, YearPoint } from './progressHubView'
import { levelStyle } from '@/components/consistency/consistencyMonthsView'
import { shortDist } from '@/components/goals/shortDistance'
import { WEAR_COLOR } from '@/components/shoes/shoeWear'

const TITLE = 'text-[15px] font-semibold text-foreground'
/** A card that opens its page: the whole surface is the target. */
const LINK_CARD = 'text-left transition-[border-color,transform] hover:border-[var(--line-2)] active:scale-[0.99]'

/** A line of whole segments: it wraps between them, never inside one (v4.3.1). */
function Segments({ parts, className, testId }: { parts: ReactNode[]; className?: string; testId?: string }) {
  return (
    <p className={cn('flex flex-wrap gap-x-1 whitespace-nowrap text-xs text-muted-foreground', className)} data-testid={testId}>
      {parts.map((part, i) => (
        <span key={i} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden="true">· </span>}
          {part}
        </span>
      ))}
    </p>
  )
}

/** A tile that opens its sub-page: its title, a chevron or a caption, then its figure. */
function Tile({ href, title, aside, className, children, testId }: { href: string; title: string; aside?: ReactNode; className?: string; children: ReactNode; testId?: string }) {
  return (
    <Link href={href} data-testid={testId} className={cardClass({ className: cn('flex flex-col gap-2.5', LINK_CARD, className) })}>
      <div className="flex items-center justify-between gap-2">
        <span className={TITLE}>{title}</span>
        {aside ?? <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
      </div>
      {children}
    </Link>
  )
}

/** A caption on the right of a card's title, with the chevron the card's link needs. */
function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </span>
  )
}

const CHART_W = 1000
const CHART_H = 110

function path(points: YearPoint[], x: (day: number) => number, y: (km: number) => number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)} ${y(p.km).toFixed(1)}`).join(' ')
}

/**
 * This year's km against last year's and the goal (v4.17): the year is the
 * athlete's own data, so the accent; last year is the neutral line-2, and
 * the goal a dashed muted line.
 */
function YearChart({ hero }: { hero: ProgressHubView['hero'] }) {
  const last = hero.current.at(-1)
  const top = Math.max(hero.goalKm ?? 0, last?.km ?? 0, hero.previous.at(-1)?.km ?? 0, 1)
  const x = (day: number) => (day / hero.daysInYear) * CHART_W
  const y = (km: number) => CHART_H - 2 - (km / top) * (CHART_H - 10)

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-[110px] w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="year-chart">
      {hero.goalKm !== null && (
        <line x1={0} y1={y(0)} x2={CHART_W} y2={y(hero.goalKm)} stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" data-testid="goal-line" />
      )}
      {hero.previous.length > 1 && (
        <path d={path(hero.previous, x, y)} fill="none" stroke="var(--line-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" data-testid="previous-line" />
      )}
      <path d={path(hero.current, x, y)} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-testid="current-line" />
    </svg>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-[50px]" />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * 1000).toFixed(1)} ${(4 + (1 - (hi > lo ? (v - lo) / (hi - lo) : 0.5)) * 42).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox="0 0 1000 50" className="block h-[50px] w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="vo2-sparkline">
      <path d={d} fill="none" stroke="var(--foreground)" strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Twelve weeks as columns, Monday on top, with every other day named (v4.17). */
function MiniCalendar({ weeks }: { weeks: HeatCell[][] }) {
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `14px repeat(${weeks.length}, minmax(0, 1fr))` }} aria-hidden="true" data-testid="heatmap">
      {Array.from({ length: 7 }, (_, day) => [
        <span key={`label-${day}`} className="flex items-center text-caption leading-none text-muted-foreground">
          {/* 2024-01-01 was a Monday. */}
          {day % 2 === 0 ? narrow.format(new Date(Date.UTC(2024, 0, 1 + day))) : ''}
        </span>,
        ...weeks.map((week, w) => {
          const cell = week[day]!
          return (
            <span
              key={`${w}-${day}`}
              className="block aspect-square rounded-[3px]"
              data-level={cell.future ? undefined : cell.level}
              data-today={cell.today || undefined}
              style={levelStyle(cell.level, { today: cell.today, future: cell.future })}
            />
          )
        }),
      ])}
    </div>
  )
}

function Bar({ share, color }: { share: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className="h-full rounded-full" data-testid="bar-fill" style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 1000) / 10}%`, background: color }} />
    </div>
  )
}

/**
 * How far the prediction sits from the target, as a bar: full at or under
 * the target, a fifth off for every 1% slower.
 */
export function raceShare(predicted: number, target: number): number {
  if (predicted <= target) return 1
  return Math.max(0.05, 1 - ((predicted - target) / target) * 5)
}

/** A shoe's bar and tag (v4.17): the accent while it has life, warn from Replace soon. */
function shoeColor(status: WearStatus): string {
  return WEAR_COLOR[status]
}

/**
 * Progress as a visual hub (H01, M12; v4.17.1): the year against last year
 * and the goal, then two columns that stack on their own - Next race, Records
 * and the shoes; VO₂ max and Consistency - and all time with its km by year.
 * Every card opens the page it summarises.
 */
export function ProgressHub({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { hero, race, vo2max, records, consistency, shoes, allTime } = view
  const raceGap = race?.predictedSeconds != null && race.targetSeconds ? race.predictedSeconds - race.targetSeconds : null
  const raceTone = raceGap !== null && raceGap > 0 ? 'var(--warn)' : 'var(--pos)'
  const days = h.consistencyDays(consistency.activeDays)
  const streak = h.consistencyStreak(consistency.streakWeeks)
  const bestYearKm = Math.max(1, ...allTime.years.slice(-2).map((y) => y.km))

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display text-foreground">{t.nav.items.profile}</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="progress-subtitle">
            {h.season(view.year)}
            {race && ` · ${h.raceIn(shortDist(race.distance), race.daysUntil)}`}
          </p>
        </div>
        {/* Settings is a sidebar row on a wide screen; on a phone it is here,
            44 pt like every control (design review, Oct 2026). */}
        <Link
          href="/settings"
          aria-label={h.settings}
          data-testid="settings-gear"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform active:scale-95 lg:hidden"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
      </header>

      <Link href="/goals" className={cardClass({ className: cn('flex flex-col gap-3', LINK_CARD) })} data-testid="year-hero">
        <div className="flex items-baseline justify-between gap-3">
          <span className={TITLE}>{h.yearTitle(view.year)}</span>
          {hero.deltaKm !== null && (
            // Coloured by what it means, against the km it is measured on.
            <span className="text-right text-xs" data-testid="year-delta" style={{ color: deltaColor('distance', hero.deltaKm, { value: hero.compareKm ?? hero.km }) }}>
              {hero.compareSince
                ? h.vsYearSince(formatDelta(hero.deltaKm), view.year - 1, formatDate(hero.compareSince, { style: 'bare', year: 'never' }))
                : h.vsYear(formatDelta(hero.deltaKm), view.year - 1)}
            </span>
          )}
        </div>
        <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
          {formatKm(hero.km)}
          <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">
            {hero.goalKm !== null ? h.ofGoal(formatKm(hero.goalKm)) : t.units.km}
          </span>
        </p>
        <YearChart hero={hero} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <Legend>
            <LegendItem swatch="line" color="var(--accent)">{view.year}</LegendItem>
            {hero.previous.length > 1 && <LegendItem swatch="line" color="var(--line-2)">{view.year - 1}</LegendItem>}
            {hero.goalKm !== null && <LegendItem swatch="dash" color="var(--muted-foreground)">{h.goal}</LegendItem>}
          </Legend>
          <span>{h.runsHours(hero.runs, hero.hours)}</span>
        </div>
      </Link>

      {/* Two columns that stack on their own (v4.17.1): Next race, Records and
          the shoes on the left, VO2 max and Consistency on the right, so no
          card waits under a shorter neighbour. On a phone the columns melt
          into one list (display: contents) and `order` interleaves them:
          race, VO2 max, records, consistency, shoes. */}
      <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-2 sm:items-start" data-testid="progress-columns">
        <div className="contents sm:flex sm:flex-col sm:gap-3.5" data-testid="progress-column">
          <Tile href="/goals" title={h.nextRace} className="order-1 sm:order-none" testId="race-tile">
            {race ? (
              <>
                <p className="text-[26px] font-semibold leading-tight text-foreground">
                  {Math.max(0, race.daysUntil)}
                  <Unit>{h.raceMeta(race.daysUntil, [shortDist(race.distance), race.name].filter(Boolean).join(' '), formatDate(race.date, { style: 'bare' }))}</Unit>
                </p>
                {race.predictedSeconds !== null && (
                  <>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-muted-foreground">{h.predicted}</span>
                      <span className="font-semibold text-foreground">{formatDuration(race.predictedSeconds)}</span>
                    </div>
                    {race.targetSeconds && raceGap !== null && (
                      <>
                        <Bar share={raceShare(race.predictedSeconds, race.targetSeconds)} color={raceTone} />
                        <p className="text-xs text-muted-foreground" data-testid="race-target">
                          {h.target(formatDuration(race.targetSeconds))}
                          {' · '}
                          <b className="font-semibold" style={{ color: raceTone }}>
                            {raceGap > 0 ? h.toFind(formatDuration(raceGap)) : h.underTarget(formatDuration(-raceGap))}
                          </b>
                        </p>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{h.noRace}</p>
            )}
          </Tile>

          <Tile href="/records" title={h.records} aside={<Caption>{h.recordsWhen}</Caption>} className="order-3 gap-1 sm:order-none" testId="records-tile">
            {records.length > 0 ? (
              <dl className="mt-1.5">
                {records.map((r) => (
                  <div key={r.key} className="flex items-baseline justify-between gap-2 border-t border-border py-[9px] text-sm">
                    <dt className="text-foreground">{h.recordLabels[r.key] ?? r.label}</dt>
                    {/* The newest record says so in the accent; "new" only while it is (v4.17). */}
                    <dd className="flex items-baseline gap-1.5 font-semibold text-foreground">
                      {r.latest && (
                        <span data-testid="latest-record" aria-label={h.latestRecordLabel} className="text-caption font-bold text-accent-text">
                          {r.recent ? h.newRecord : h.latestRecord}
                        </span>
                      )}
                      {formatDuration(r.seconds)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{h.noRecords}</p>
            )}
          </Tile>


          {shoes.length > 0 && (
            <section className={cardClass({ className: 'order-5 flex flex-col gap-3 sm:order-none' })} data-testid="shoes-tile">
              <div className="flex items-center justify-between gap-2">
                <h2 className={TITLE}>{h.shoes}</h2>
                {/* A link of its own, so the app's one "see all" style - the
                    accent and an arrow, as Today's "View all →" and a shoe's
                    "All 147 →"; grey chevrons mark a whole card (screen audit,
                    Oct 2026). */}
                <Link href="/shoes" className="hit-44 text-footnote font-medium text-accent-text transition-opacity hover:opacity-80 active:opacity-60" data-testid="shoes-all">
                  {h.allPairs} →
                </Link>
              </div>
              {shoes.map((s) => (
                <Link key={s.gearId} href={`/shoes/${s.gearId}`} className="flex flex-col gap-2 transition-opacity active:opacity-70" data-testid="shoe-row">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words text-foreground text-pretty">
                      {s.name}
                      {s.status !== 'ok' && (
                        <span className="ml-1.5 text-xs" style={{ color: shoeColor(s.status) }} data-testid="shoe-status">{t.shoes.status[s.status]}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                      <b className="font-semibold text-foreground">{formatKm(s.km)}</b>&nbsp;/ {formatKm(s.maxKm)} {t.units.km}
                      <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                  <Bar share={s.maxKm > 0 ? s.km / s.maxKm : 0} color={shoeColor(s.status)} />
                </Link>
              ))}
            </section>
          )}
        </div>
        <div className="contents sm:flex sm:flex-col sm:gap-3.5" data-testid="progress-column">
          <Tile href="/athlete" title={h.vo2max} className="order-2 sm:order-none" testId="vo2-tile">
            {vo2max ? (
              <>
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[26px] font-semibold leading-tight text-foreground">{vo2max.value}</span>
                  {vo2max.delta !== null && (
                    <span className="text-xs" data-testid="vo2-delta" style={{ color: deltaColor('vo2max', vo2max.delta) }}>
                      {h.vo2Delta(formatDelta(vo2max.delta))}
                    </span>
                  )}
                </p>
                <Sparkline values={vo2max.series} />
                <Segments
                  testId="vo2-footer"
                  parts={h.thresholdParts(vo2max.thresholdPaceSecPerKm ? formatDuration(vo2max.thresholdPaceSecPerKm) : null, vo2max.lthrBpm)}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">–</p>
            )}
          </Tile>

          <Tile href="/consistency" title={h.consistency} className="order-4 sm:order-none" testId="consistency-tile">
            <MiniCalendar weeks={consistency.weeks} />
            <Segments
              testId="consistency-footer"
              parts={[
                h.consistencyWindow,
                <>{days.lead}<b className="font-semibold text-foreground">{days.value}</b>{days.tail}</>,
                <>{streak.lead}<b className="font-semibold text-foreground">{streak.value}</b>{streak.tail}</>,
              ]}
            />
          </Tile>
        </div>
      </div>

      <Link href="/all-time" aria-label={h.openYears} className={cardClass({ className: cn('flex flex-col gap-3.5', LINK_CARD) })} data-testid="all-time">
        <div className="flex items-baseline justify-between gap-2">
          <span className={TITLE}>{h.allTime}</span>
          {allTime.since && <Caption>{h.since(formatDate(allTime.since, { precision: 'month', year: 'always' }))}</Caption>}
        </div>
        <StatGrid columns={3}>
          <Stat label={h.distance} value={formatKm(allTime.km)} unit={t.units.km} valueStyle={{ fontSize: 24 }} />
          <Stat label={h.runsLabel} value={allTime.runs} valueStyle={{ fontSize: 24 }} />
          <Stat label={h.time} value={formatKm(allTime.hours)} unit={h.hours} valueStyle={{ fontSize: 24 }} />
        </StatGrid>
        {/* This year and last as rows (C6): this year the accent, last year line-2. */}
        <ul className="flex flex-col gap-3 border-t border-border pt-3 text-[13px]" data-testid="year-rows">
          {[...allTime.years.slice(-2)].reverse().map((y) => {
            const current = y.year === view.year
            return (
              <li key={y.year} className="grid grid-cols-[44px_minmax(0,1fr)_150px] items-center gap-3" data-testid="year-row">
                <span className={cn(current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{y.year}</span>
                <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span className="block h-full rounded-full" data-testid="year-bar" style={{ width: `${(y.km / bestYearKm) * 100}%`, background: current ? 'var(--accent)' : 'var(--line-2)' }} />
                </span>
                <span className="text-right text-muted-foreground">
                  <b className="font-semibold text-foreground">{formatKm(y.km)} {t.units.km}</b> · {t.common.runs(y.runs)}
                </span>
              </li>
            )
          })}
        </ul>
      </Link>
    </div>
  )
}
