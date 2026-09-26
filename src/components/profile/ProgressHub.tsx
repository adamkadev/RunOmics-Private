import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatCountdown, formatDate, formatDelta, formatDuration, formatKm, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { ProgressHubView, YearPoint } from './progressHub'
import { YearRows } from './AllTime'

const TITLE = 'font-display text-subhead font-semibold text-foreground'
const MUTED = 'text-footnote text-muted-foreground'

/** Inter's average advance at this size, a little over, in ems per character. */
const EM_PER_CHAR = 0.5

/**
 * A tile's footer, "threshold 4:23 · LTHR 185": one line (v4.3.4), each
 * segment whole. At 13 px it wants ~158 px and a tile on a 393 pt phone
 * gives ~143, so the line is its own container and its size is the smaller
 * of 13 px and what its length fits in, never under the 11 px floor. The
 * first segment's dot is pulled out and clipped, so the line starts clean.
 */
function FooterLine({ parts, className, testId }: { parts: string[]; className?: string; testId?: string }) {
  const chars = parts.join(' · ').length
  return (
    <div className={cn('overflow-hidden', className)} style={{ containerType: 'inline-size' }}>
      <p
        className="-ml-2 flex whitespace-nowrap leading-snug text-muted-foreground"
        style={{ fontSize: `clamp(11px, calc(100cqw / ${(chars * EM_PER_CHAR).toFixed(1)}), 13px)` }}
        data-testid={testId}
      >
        {parts.map((part) => (
          <span key={part} className="whitespace-nowrap">
            <span aria-hidden="true" className="inline-block w-2 text-center">·</span>
            {part}
          </span>
        ))}
      </p>
    </div>
  )
}

/** A tile that opens its sub-page: a title with a chevron, then its figure. */
function Tile({ href, title, className, children, testId }: { href: string; title: string; className?: string; children: ReactNode; testId?: string }) {
  return (
    <Link href={href} data-testid={testId} className="block transition-transform active:scale-[0.99]">
      <GlassSurface variant="card" className={cn('h-full rounded-[22px] px-4 py-3.5', className)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={TITLE}>{title}</span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-subtle" />
        </div>
        {children}
      </GlassSurface>
    </Link>
  )
}

const CHART_W = 300
const CHART_H = 120

function path(points: YearPoint[], x: (day: number) => number, y: (km: number) => number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)} ${y(p.km).toFixed(1)}`).join(' ')
}

/** This year's km against last year's and the goal line (H01, M12). */
function YearChart({ hero }: { hero: ProgressHubView['hero'] }) {
  const last = hero.current.at(-1)
  const top = Math.max(hero.goalKm ?? 0, last?.km ?? 0, hero.previous.at(-1)?.km ?? 0, 1)
  const x = (day: number) => (day / hero.daysInYear) * CHART_W
  const y = (km: number) => CHART_H - (km / top) * (CHART_H - 6)
  const line = path(hero.current, x, y)

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-3 h-[120px] w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="year-chart">
      {hero.goalKm !== null && (
        <line x1={0} y1={y(0)} x2={CHART_W} y2={y(hero.goalKm)} stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      )}
      {last && <path d={`${line} L${x(last.day).toFixed(1)} ${CHART_H} L0 ${CHART_H} Z`} fill="var(--accent)" fillOpacity={0.18} />}
      {hero.previous.length > 1 && (
        <path d={path(hero.previous, x, y)} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} vectorEffect="non-scaling-stroke" data-testid="previous-line" />
      )}
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-10" />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * 100).toFixed(1)} ${(36 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * 32).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true" data-testid="vo2-sparkline">
      <path d={d} fill="none" stroke="var(--metric-fitness)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const HEAT_FILL = ['var(--heat-empty)', 'color-mix(in srgb, var(--accent) 40%, transparent)', 'color-mix(in srgb, var(--accent) 70%, transparent)', 'var(--accent)']

function Heatmap({ weeks }: { weeks: (number | null)[][] }) {
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]" aria-hidden="true" data-testid="heatmap">
      {weeks.flatMap((week, w) =>
        week.map((level, d) => (
          <span key={`${w}-${d}`} className="block aspect-square rounded-[2px]" style={{ background: level === null ? 'transparent' : HEAT_FILL[level] }} />
        )),
      )}
    </div>
  )
}

function Bar({ share, color }: { share: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
      <div className="h-full rounded-full" style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`, background: color }} />
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

/**
 * Progress as a visual hub (H01, M12): the year against last year and the
 * goal, then Race, VO₂max, Records and Consistency tiles, the shoes, and all
 * time with its km by year. Every tile opens the sub-page it summarises.
 */
export function ProgressHub({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { hero, race, vo2max, records, consistency, shoes, allTime } = view

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-title1 font-bold tracking-tight text-foreground">{t.nav.items.profile}</h1>
        <Link
          href="/settings"
          aria-label={h.settings}
          className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform active:scale-95"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
      </div>

      <Link href="/goals" className="block transition-transform active:scale-[0.99]" data-testid="year-hero">
        {/* Progress's one hero surface (v4.3): a 1.5 px accent border. */}
        <GlassSurface variant="card" className="rounded-[22px] px-4.5 py-4" style={{ border: '1.5px solid var(--acc-line)' }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption font-semibold tracking-[0.12em] text-muted-foreground">{view.year}</span>
            {hero.deltaKm !== null && (
              <span className="text-footnote tabular-nums text-muted-foreground">
                {h.vsYear(formatDelta(hero.deltaKm), view.year - 1)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-foreground">
            <span className="font-display text-[40px] font-bold leading-none tabular-nums">{formatKm(hero.km)}</span>
            <span className="ml-1.5 text-subhead text-muted-foreground">{hero.goalKm !== null ? h.ofGoal(formatKm(hero.goalKm)) : t.units.km}</span>
          </p>
          <YearChart hero={hero} />
          <div className={cn('mt-2 flex items-center justify-between gap-3', MUTED)}>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-accent" />{view.year}</span>
              {hero.previous.length > 1 && (
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted-foreground" />{view.year - 1}</span>
              )}
              {hero.goalKm !== null && <span>- - {h.goal}</span>}
            </span>
            <span className="tabular-nums">{h.hoursRuns(hero.hours, hero.runs)}</span>
          </div>
        </GlassSurface>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/goals" title={h.race} testId="race-tile">
          {race ? (
            <>
              <p className="font-display text-title2 font-bold leading-none" style={{ color: 'var(--tone-caution)' }}>{formatCountdown(race.daysUntil)}</p>
              <p className={cn('mt-2', MUTED)}>{h.raceLine(race.distance, formatDate(race.date, { style: 'bare' }))}</p>
              {race.predictedSeconds !== null && (
                <>
                  <div className="mt-2 flex items-baseline justify-between text-footnote">
                    <span className="text-muted-foreground">{h.predicted}</span>
                    <span className="font-bold tabular-nums text-foreground">{formatDuration(race.predictedSeconds)}</span>
                  </div>
                  {race.targetSeconds && (
                    <>
                      <div className="mt-1.5">
                        <Bar
                          share={raceShare(race.predictedSeconds, race.targetSeconds)}
                          color={race.predictedSeconds <= race.targetSeconds ? 'var(--accent)' : 'var(--tone-caution)'}
                        />
                      </div>
                      <p className={cn('mt-1.5', MUTED)}>{h.target(formatDuration(race.targetSeconds))}</p>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <p className={MUTED}>{h.noRace}</p>
          )}
        </Tile>

        <Tile href="/athlete" title={h.vo2max} testId="vo2-tile">
          {vo2max ? (
            <>
              <p className="flex items-baseline gap-1.5">
                <span className="font-display text-title2 font-bold leading-none tabular-nums text-foreground">{vo2max.value}</span>
                {vo2max.delta !== null && (
                  <span className="text-footnote tabular-nums text-muted-foreground">
                    {h.in90d(formatDelta(vo2max.delta))}
                  </span>
                )}
              </p>
              <div className="mt-2">
                <Sparkline values={vo2max.series} />
              </div>
              <FooterLine
                className="mt-1.5"
                testId="vo2-footer"
                parts={h.thresholdParts(vo2max.thresholdPaceSecPerKm ? formatPace(vo2max.thresholdPaceSecPerKm).replace(' /km', '') : null, vo2max.lthrBpm)}
              />
            </>
          ) : (
            <p className={MUTED}>–</p>
          )}
        </Tile>

        <Tile href="/records" title={h.records} testId="records-tile">
          {records.length > 0 ? (
            <dl className="space-y-1">
              {records.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between gap-2 text-subhead">
                  <dt className="text-foreground">{r.label}</dt>
                  {/* The newest record says so in the accent, rather than an
                      accented time that explained nothing (v4.3.3). */}
                  <dd className="flex items-baseline gap-1.5 font-bold tabular-nums text-foreground">
                    {r.latest && (
                      <span
                        data-testid="latest-record"
                        aria-label={h.latestRecordLabel}
                        className="text-caption font-bold text-accent-text"
                      >
                        {h.latestRecord}
                      </span>
                    )}
                    {formatDuration(r.seconds)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={MUTED}>{h.noRecords}</p>
          )}
        </Tile>

        <Tile href="/consistency" title={h.consistency} testId="consistency-tile">
          <Heatmap weeks={consistency.weeks} />
          <FooterLine className="mt-2" testId="consistency-footer" parts={h.consistencyParts(consistency.activeDays, consistency.streakWeeks)} />
        </Tile>
      </div>

      {shoes.length > 0 && (
        <Tile href="/shoes" title={h.shoes} testId="shoes-tile">
          <div className="space-y-2.5">
            {shoes.map((s) => (
              <div key={s.gearId}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-subhead">
                  <span className="truncate text-foreground">{s.name}</span>
                  <span className="shrink-0 tabular-nums" style={{ color: s.warn ? 'var(--tone-caution)' : 'var(--muted-foreground)' }}>
                    {s.km} / {s.maxKm} {t.units.km}
                  </span>
                </div>
                <Bar share={s.maxKm > 0 ? s.km / s.maxKm : 0} color={s.warn ? 'var(--tone-caution)' : 'var(--accent)'} />
              </div>
            ))}
          </div>
        </Tile>
      )}

      <Link href="/all-time" aria-label={h.openYears} className="block transition-transform active:scale-[0.99]" data-testid="all-time">
        <GlassSurface variant="card" className="rounded-[22px] px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className={TITLE}>{h.allTime}</span>
            {allTime.since && (
              <span className={cn('flex items-center gap-1', MUTED)}>
                {h.since(formatDate(allTime.since, { precision: 'month', year: 'always' }))}
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[
              [formatKm(allTime.km), t.units.km],
              [String(allTime.runs), h.runs],
              [formatKm(allTime.hours), h.hours],
            ].map(([value, unit]) => (
              <div key={unit}>
                <p className="font-display text-title3 font-bold leading-none tabular-nums text-foreground">{value}</p>
                <p className={cn('mt-1', MUTED)}>{unit}</p>
              </div>
            ))}
          </div>
          {/* The All time page's By year rows, compact (C6), in place of two big bars. */}
          <div className="mt-3.5">
            <YearRows years={allTime.years.slice(-2)} currentYear={view.year} compact />
          </div>
        </GlassSurface>
      </Link>
    </div>
  )
}
