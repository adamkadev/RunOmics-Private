import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDelta, formatDuration, formatKm, formatSignedDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import type { WearStatus } from '@/domain/shoe/wearStatus'
import { raceGapView, type HeatCell, type ProgressHubView, type YearPoint } from './progressHubView'
import { levelStyle } from '@/components/consistency/consistencyRamp'
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

/** VO2max over the window, its ends dotted; a flat window draws as a short strip. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-[50px]" />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const flat = hi === lo
  const height = flat ? 16 : 50
  const yOf = (v: number) => (flat ? 0.5 : 4 / 50 + (1 - (v - lo) / (hi - lo)) * (42 / 50))
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * 1000).toFixed(1)} ${(yOf(v) * height).toFixed(1)}`).join(' ')
  const dot = (v: number, left: string, last: boolean) => (
    <span
      aria-hidden
      className={cn('absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full', last ? 'bg-foreground' : 'bg-muted-foreground')}
      style={{ left, top: `${yOf(v) * 100}%` }}
    />
  )
  return (
    <div className="relative mx-[3px]" style={{ height }} data-testid="vo2-spark">
      <svg viewBox={`0 0 1000 ${height}`} className="block h-full w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="vo2-sparkline" data-flat={flat || undefined}>
        <path d={d} fill="none" stroke="var(--foreground)" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {dot(values[0]!, '0%', false)}
      {dot(values.at(-1)!, '100%', true)}
    </div>
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

/** A shoe's bar and tag (v4.17): the accent while it has life, warn from Replace soon. */
function shoeColor(status: WearStatus): string {
  return WEAR_COLOR[status]
}

const CHART_W = 1000
const CHART_H = 110
/** The months named under the year chart (3.0): the quarters, and December at the end. */
const TICK_MONTHS = [0, 3, 6, 9, 11]

function path(points: YearPoint[], x: (day: number) => number, y: (km: number) => number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)} ${y(p.km).toFixed(1)}`).join(' ')
}

/** The projection's colour: warn when it falls short of the goal, pos when it lands on it or over. */
function projectionColor(hero: ProgressHubView['hero']): string {
  return hero.projection && hero.goalKm !== null && hero.projection.yearKm < hero.goalKm ? 'var(--warn)' : 'var(--pos)'
}

/** The year chart's y-axis (3.0.2): zero, a third, two thirds and the goal - or the chart's top without one. */
export function yearTicks(goalKm: number | null, top: number): number[] {
  const end = goalKm ?? top
  return [0, end / 3, (end * 2) / 3, end].map(Math.round)
}

/**
 * The year's cumulative km (3.0): the athlete's own line in the accent, the
 * projection to 31 December dashed in its verdict colour, the goal a dotted
 * straight line from zero to its labelled end. Since 3.0.2 the gridlines are
 * the y-axis ticks, each named in the gutter.
 */
function YearChart({ hero, year }: { hero: ProgressHubView['hero']; year: number }) {
  const h = t.profile.hub
  const last = hero.current.at(-1) ?? { day: 0, km: 0 }
  const top = Math.max(hero.goalKm ?? 0, hero.projection?.yearKm ?? 0, last.km, 1)
  const x = (day: number) => (day / hero.daysInYear) * CHART_W
  const y = (km: number) => CHART_H - 2 - (km / top) * (CHART_H - 8)
  const at = (km: number) => `${((y(km) / CHART_H) * 100).toFixed(2)}%`
  const ticks = yearTicks(hero.goalKm, top)
  const months = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' })
  const dayOf = (month: number) => Math.round((Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86_400_000)

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pt-2.5">
      <div className="relative h-[110px] text-right text-caption leading-none text-muted-foreground tabular-nums" aria-hidden="true" data-testid="year-y-ticks">
        {/* The widest label holds the gutter open; the others sit on their lines. */}
        <span className="invisible">{formatKm(Math.max(...ticks))}</span>
        {ticks.map((km, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: at(km) }}>
            {formatKm(km)}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-[110px] w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="year-chart">
          {ticks.map((km, i) => (
            <line key={i} x1={0} x2={CHART_W} y1={y(km)} y2={y(km)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {hero.goalKm !== null && (
            <line x1={0} y1={y(0)} x2={CHART_W} y2={y(hero.goalKm)} stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="1 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" data-testid="goal-line" />
          )}
          {hero.projection && (
            <line
              x1={x(last.day)}
              y1={y(last.km)}
              x2={CHART_W}
              y2={y(hero.projection.yearKm)}
              stroke={projectionColor(hero)}
              strokeWidth={1.6}
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
              data-testid="projection-path"
            />
          )}
          <path d={path(hero.current, x, y)} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-testid="current-line" />
        </svg>
        {hero.goalKm !== null && (
          // Over the goal line's end, in the headroom the grid leaves above the chart.
          <span className="absolute right-0 -translate-y-full whitespace-nowrap text-caption leading-none text-muted-foreground" style={{ top: `calc(${at(hero.goalKm)} - 3px)` }} aria-hidden="true" data-testid="goal-label">
            {h.goalLabel(formatKm(hero.goalKm))}
          </span>
        )}
      </div>
      <span aria-hidden="true" />
      <div className="relative mt-2 h-3.5 text-caption leading-[14px] text-muted-foreground" aria-hidden="true" data-testid="year-ticks">
        {TICK_MONTHS.map((month, i) => {
          const edge = i === 0 ? 'left' : i === TICK_MONTHS.length - 1 ? 'right' : null
          const left = `${((dayOf(month) / hero.daysInYear) * 100).toFixed(2)}%`
          return (
            <span
              key={month}
              className={cn('absolute whitespace-nowrap', !edge && '-translate-x-1/2')}
              style={edge === 'left' ? { left: 0 } : edge === 'right' ? { right: 0 } : { left }}
            >
              {months.format(new Date(Date.UTC(year, month, 1))).replace(/\.$/, '')}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** One figure of the race's Target · Predicted · Gap row: its label in caps over the time. */
function RaceFigure({ label, value, className, testId }: { label: string; value: string; className?: string; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('whitespace-nowrap text-[22px] font-bold leading-tight tracking-[-0.01em] tabular-nums text-foreground', className)} data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}

/**
 * The next race (3.0, 3.0.2): the one card in the accent. The distance and
 * date on one line with the countdown across from it, the name on its own
 * line, then Target · Predicted · Gap - the gap warn while the prediction is
 * slower, pos under it - over a bar of where the predicted pace is when the
 * target clock stops, and the gap per km.
 */
function RaceCard({ race }: { race: ProgressHubView['race'] }) {
  const h = t.profile.hub
  const gap = race ? raceGapView(race) : null
  return (
    <Link href="/goals" className={cardClass({ className: cn('flex flex-col gap-2.5 rounded-3xl border-accent', LINK_CARD, 'hover:border-accent') })} data-testid="race-tile">
      {race ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn(EYEBROW_CLASS, 'whitespace-nowrap text-accent-text')} data-testid="race-eyebrow">
              {shortDist(race.distance)} · {formatDate(race.date, { style: 'bare', year: 'always' })}
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" data-testid="race-countdown">{h.inDays(race.daysUntil)}</span>
          </div>
          {race.name && <p className="break-words text-[15px] font-semibold text-foreground text-pretty" data-testid="race-name">{race.name}</p>}
          {(race.targetSeconds || race.predictedSeconds !== null) && (
            <dl className="grid grid-cols-3 gap-2" data-testid="race-figures">
              {race.targetSeconds ? <RaceFigure label={h.target} value={formatDuration(race.targetSeconds)} testId="race-target" /> : null}
              {race.predictedSeconds !== null && <RaceFigure label={h.predicted} value={formatDuration(race.predictedSeconds)} testId="race-predicted" />}
              {gap && (
                <RaceFigure
                  label={h.gap}
                  value={formatSignedDuration(gap.gapSeconds)}
                  className={gap.gapSeconds > 0 ? 'text-[var(--warn)]' : 'text-[var(--pos)]'}
                  testId="race-gap"
                />
              )}
            </dl>
          )}
          {gap && (
            <>
              <div role="img" aria-label={h.reached(Math.floor(gap.reached * 100))} className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]" data-testid="race-bar">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(gap.reached * 1000) / 10}%` }} />
              </div>
              {gap.perKmSeconds !== null && (
                <p className="text-xs text-muted-foreground" data-testid="race-caption">
                  {gap.gapSeconds > 0 ? h.perKmToFind(gap.perKmSeconds) : gap.gapSeconds < 0 ? h.perKmInHand(gap.perKmSeconds) : h.onTarget}
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{h.noRace}</p>
      )}
    </Link>
  )
}

/** The year against last year and its goal, the line to date and where it lands (3.0). */
function YearCard({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { hero } = view
  const projection = hero.projection
  const shortKm = projection && hero.goalKm !== null ? projection.yearKm - hero.goalKm : null
  return (
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
      <p className="text-[30px] font-bold leading-none tracking-[-0.02em] text-foreground">
        {formatKm(hero.km)}
        <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">
          {hero.goalKm !== null ? h.ofGoal(formatKm(hero.goalKm)) : t.units.km}
        </span>
      </p>
      <YearChart hero={hero} year={view.year} />
      {hero.goalKm !== null && (
        // The verdict in its tone, then what the goal needs (C3, 3.0), then
        // what the dotted line is (3.0.2).
        <p className="text-[13px] leading-normal text-[var(--text-2)]" data-testid="projection-line">
          {projection && shortKm !== null && (
            <>
              <b className="font-semibold" style={{ color: projectionColor(hero) }} data-testid="projection-verdict">
                {shortKm < 0 ? h.shortBy(formatKm(-shortKm)) : shortKm > 0 ? h.overBy(formatKm(shortKm)) : h.onPace}
              </b>{' '}
              {shortKm !== 0 && `${h.atPace} `}
              {h.needs(formatKm(projection.weeklyNeeded), formatKm(projection.weeklyRate))}{' '}
            </>
          )}
          <span className="text-muted-foreground" data-testid="goal-line-note">{h.goalLine}</span>
        </p>
      )}
    </Link>
  )
}

/** The four record distances as 2 x 2 tiles, the newest tagged while it is new (3.0). */
/**
 * The four hub records in one card (3.0.1): label over time, side by side.
 * Four 2×2 tiles took a screen's worth of height for four numbers. The
 * whole card opens Records.
 */
function Records({ records }: { records: ProgressHubView['records'] }) {
  const h = t.profile.hub
  return (
    <Link href="/records" className={cardClass({ className: cn('flex flex-col gap-3', LINK_CARD) })} data-testid="records-tile">
      <div className="flex items-center justify-between gap-2">
        <span className={TITLE}>{h.records}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </div>
      {records.length === 0 ? (
        <span className="text-sm text-muted-foreground">{h.noRecords}</span>
      ) : (
        <dl className="grid grid-cols-4 gap-2" data-testid="records">
          {records.map((r) => (
            <div key={r.key} className="flex min-w-0 flex-col gap-0.5" data-testid="record">
              <dt className="flex items-baseline gap-1 whitespace-nowrap text-xs text-muted-foreground">
                {h.recordLabels[r.key] ?? r.label}
                {r.recent && (
                  <span data-testid="latest-record" aria-label={h.newRecordLabel} className="text-caption font-bold text-accent-text">
                    {h.newRecord}
                  </span>
                )}
              </dt>
              <dd className="whitespace-nowrap text-[17px] font-semibold tabular-nums leading-tight text-foreground">{formatDuration(r.seconds)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  )
}

/**
 * Progress · Season (H01, M12; 3.0): the race dominates, then the year
 * against its goal and the records. Under them, at the owner's request
 * (3.0.1), the tiles from before 3.0: VO₂ max and Consistency side by side,
 * the shoes, and all time with its km by year; each opens its page.
 * Settings is the gear.
 */
export function ProgressHub({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { vo2max, consistency, shoes, allTime } = view
  const days = h.consistencyDays(consistency.activeDays)
  const streak = h.consistencyStreak(consistency.streakWeeks)
  const bestYearKm = Math.max(1, ...allTime.years.slice(-2).map((y) => y.km))

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5 flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-display text-foreground">{t.nav.items.profile}</h1>
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

      <RaceCard race={view.race} />
      <YearCard view={view} />
      <Records records={view.records} />

      {/* VO2 max and Consistency side by side on a wide screen, stacked on a
          phone; then the shoes and all time (as before 3.0). */}
      <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-2 sm:items-start" data-testid="progress-columns">
        <Tile href="/athlete" title={h.vo2max} testId="vo2-tile">
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
        <Tile href="/consistency" title={h.consistency} testId="consistency-tile">
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

      {shoes.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="shoes-tile">
          <div className="flex items-center justify-between gap-2">
            <h2 className={TITLE}>{h.shoes}</h2>
            <Link href="/shoes" className="hit-44 inline-flex items-center gap-0.5 text-footnote font-medium text-accent-text transition-opacity hover:opacity-80 active:opacity-60" data-testid="shoes-all">
              {h.allPairs}
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
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
        {/* This year and last as rows (C6): this year the accent, last year the reference grey. */}
        <ul className="flex flex-col gap-3 border-t border-border pt-3 text-[13px]" data-testid="year-rows">
          {[...allTime.years.slice(-2)].reverse().map((y) => {
            const current = y.year === view.year
            return (
              <li key={y.year} className="grid grid-cols-[44px_minmax(0,1fr)_150px] items-center gap-3" data-testid="year-row">
                <span className={cn(current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{y.year}</span>
                <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span className="block h-full rounded-full" data-testid="year-bar" style={{ width: `${(y.km / bestYearKm) * 100}%`, background: current ? 'var(--accent)' : 'var(--series-2)' }} />
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
