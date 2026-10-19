import Link from 'next/link'
import { Settings } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { ListRow } from '@/components/ui/ListRow'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDelta, formatDuration, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import type { ProgressHubView, YearPoint } from './progressHubView'
import { shortDist } from '@/components/goals/shortDistance'

const TITLE = 'text-[15px] font-semibold text-foreground'
/** A card that opens its page: the whole surface is the target. */
const LINK_CARD = 'text-left transition-[border-color,transform] hover:border-[var(--line-2)] active:scale-[0.99]'

const CHART_W = 1000
const CHART_H = 90
/** The months named under the year chart (3.0): the quarters, and December at the end. */
const TICK_MONTHS = [0, 3, 6, 9, 11]

function path(points: YearPoint[], x: (day: number) => number, y: (km: number) => number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)} ${y(p.km).toFixed(1)}`).join(' ')
}

/** A gap to the race target: "46 s" under a minute, "2:10" from there. */
export function raceGap(seconds: number): string {
  return seconds < 60 ? `${seconds} ${t.units.sec}` : formatDuration(seconds)
}

/** The projection's colour: warn when it falls short of the goal, pos when it lands on it or over. */
function projectionColor(hero: ProgressHubView['hero']): string {
  return hero.projection && hero.goalKm !== null && hero.projection.yearKm < hero.goalKm ? 'var(--warn)' : 'var(--pos)'
}

/**
 * The year's cumulative km (3.0): the athlete's own line in the accent, the
 * projection to 31 December dashed in its verdict colour, the goal a dotted
 * straight line from zero, over three faint gridlines.
 */
function YearChart({ hero, year }: { hero: ProgressHubView['hero']; year: number }) {
  const last = hero.current.at(-1) ?? { day: 0, km: 0 }
  const top = Math.max(hero.goalKm ?? 0, hero.projection?.yearKm ?? 0, last.km, 1)
  const x = (day: number) => (day / hero.daysInYear) * CHART_W
  const y = (km: number) => CHART_H - 2 - (km / top) * (CHART_H - 8)
  const months = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' })
  const dayOf = (month: number) => Math.round((Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86_400_000)

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-[90px] w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="year-chart">
        {[0.25, 0.5, 0.75].map((share) => (
          <line key={share} x1={0} x2={CHART_W} y1={y(top * share)} y2={y(top * share)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
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
      <div className="relative mt-2 h-3.5 text-caption leading-[14px] text-muted-foreground" aria-hidden="true" data-testid="year-ticks">
        {TICK_MONTHS.map((month, i) => {
          const edge = i === 0 ? 'left' : i === TICK_MONTHS.length - 1 ? 'right' : null
          const at = `${((dayOf(month) / hero.daysInYear) * 100).toFixed(2)}%`
          return (
            <span
              key={month}
              className={cn('absolute whitespace-nowrap', !edge && '-translate-x-1/2')}
              style={edge === 'left' ? { left: 0 } : edge === 'right' ? { right: 0 } : { left: at }}
            >
              {months.format(new Date(Date.UTC(year, month, 1))).replace(/\.$/, '')}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The next race (3.0): the one card in the accent, a countdown, the prediction, and the gap to the target. */
function RaceCard({ race }: { race: ProgressHubView['race'] }) {
  const h = t.profile.hub
  const gap = race?.predictedSeconds != null && race.targetSeconds ? race.predictedSeconds - race.targetSeconds : null
  return (
    <Link href="/goals" className={cardClass({ className: cn('flex flex-col gap-3 rounded-3xl border-accent', LINK_CARD, 'hover:border-accent') })} data-testid="race-tile">
      {race ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn(EYEBROW_CLASS, 'text-accent-text')} data-testid="race-eyebrow">
              {shortDist(race.distance)} · {formatDate(race.date, { year: 'always' })}
            </span>
            {race.name && <span className="min-w-0 truncate text-[13px] text-muted-foreground">{race.name}</span>}
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1.5" data-testid="race-countdown">
              <span className="text-[56px] font-bold leading-none tracking-[-0.03em] text-foreground">{Math.max(0, race.daysUntil)}</span>
              <span className="text-[15px] text-muted-foreground">{h.days(race.daysUntil)}</span>
            </p>
            {race.predictedSeconds !== null && (
              <p className="flex flex-col items-end gap-0.5 text-right">
                <span className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{h.predicted}</span>
                <span className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-foreground" data-testid="race-predicted">
                  {formatDuration(race.predictedSeconds)}
                </span>
              </p>
            )}
          </div>
          {race.targetSeconds && gap !== null && (
            <p className="flex items-baseline justify-between gap-3 rounded-[14px] bg-background px-3.5 py-3 text-[13px]" data-testid="race-target">
              <span className="text-muted-foreground">{h.target(formatDuration(race.targetSeconds))}</span>
              <b className={cn('font-semibold', gap > 0 ? 'text-[var(--warn)]' : 'text-[var(--pos)]')}>
                {gap > 0 ? h.toFind(raceGap(gap)) : h.underTarget(raceGap(-gap))}
              </b>
            </p>
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
      {projection && shortKm !== null && (
        // The verdict in its tone, then what the goal needs (C3, 3.0).
        <p className="text-[13px] leading-normal text-[var(--text-2)]" data-testid="projection-line">
          <b className="font-semibold" style={{ color: projectionColor(hero) }} data-testid="projection-verdict">
            {shortKm < 0 ? h.shortBy(formatKm(-shortKm)) : shortKm > 0 ? h.overBy(formatKm(shortKm)) : h.onPace}
          </b>{' '}
          {shortKm !== 0 && `${h.atPace} `}
          {h.needs(formatKm(projection.weeklyNeeded), formatKm(projection.weeklyRate))}
        </p>
      )}
    </Link>
  )
}

/** The four record distances as 2 x 2 tiles, the newest tagged while it is new (3.0). */
function Records({ records }: { records: ProgressHubView['records'] }) {
  const h = t.profile.hub
  const tile = cardClass({ padding: 'none', className: cn('flex flex-col gap-1 rounded-[18px] px-4 py-3.5', LINK_CARD) })
  if (records.length === 0) {
    return (
      <Link href="/records" className={tile} data-testid="records-tile">
        <span className={TITLE}>{h.records}</span>
        <span className="text-sm text-muted-foreground">{h.noRecords}</span>
      </Link>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="records">
      {records.map((r) => (
        <Link key={r.key} href="/records" className={tile} data-testid="records-tile">
          <span className="flex items-baseline justify-between gap-2 text-[13px] text-muted-foreground">
            {h.recordLabels[r.key] ?? r.label}
            {r.recent && (
              <span data-testid="latest-record" aria-label={h.newRecordLabel} className="text-caption font-bold text-accent-text">
                {h.newRecord}
              </span>
            )}
          </span>
          <span className="text-2xl font-bold leading-tight tracking-[-0.01em] text-foreground">{formatDuration(r.seconds)}</span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Progress · Season (H01, M12; 3.0): the race dominates, then the year
 * against its goal and the records; every other Progress page is a row
 * under them, its live status on the row. Settings is the gear.
 */
export function ProgressHub({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { athlete, consistency, shoes, allTime } = view
  const worn = shoes.find((s) => s.status !== 'ok')

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

      <nav aria-label={t.nav.items.profile} className={cardClass({ padding: 'none', overflow: true, className: 'divide-y divide-border rounded-[18px]' })} data-testid="progress-rows">
        <ListRow href="/athlete" title={h.athlete} status={h.athleteStatus(athlete.vo2max, athlete.lthrBpm)} />
        <ListRow href="/consistency" title={h.consistency} status={h.consistencyStatus(consistency.activeDays, consistency.streakWeeks)} />
        <ListRow
          href="/all-time"
          title={h.allTime}
          status={h.allTimeStatus(formatKm(allTime.km), allTime.since ? formatDate(allTime.since, { precision: 'month', year: 'always' }) : null)}
        />
        <ListRow
          href="/shoes"
          title={h.shoes}
          status={worn ? h.shoeStatus(worn.name, t.shoes.status[worn.status]) : shoes.length > 0 ? t.profile.shoes.pairs(shoes.length) : null}
          tone={worn ? 'warn' : 'default'}
        />
      </nav>
    </div>
  )
}
