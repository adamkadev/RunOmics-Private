'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatKm, formatRanKm } from '@/lib/formatters'
import { Stat, StatGrid, Unit } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, EmptyWeek, Legend, LegendItem, Sentence, THIS_WEEK_BORDER } from './AnalyticsKit'
import { LONG_RUN_SHARE, ON_PLAN_SHARE, longRunView, weeklyDistanceView, type WeekRow, type YtdInput } from './analyticsView'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** The athlete's own weeks are the accent (v4.17): full at or above plan, 40% below it or unplanned. */
const ACCENT = 'var(--accent)'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent) 40%, transparent)'

/** Four labels under a row of weekly bars: the first, two between, and the last. */
export function weekLabels(weeks: string[], live: boolean): string[] {
  const n = weeks.length
  if (!n) return []
  const step = Math.max(1, Math.ceil(n / 3))
  const picks = [0, step, step * 2].filter((i) => i < n - 1)
  return [...picks.map((i) => bare(weeks[i]!)), live ? t.analytics.cards.thisWeek : bare(weeks[n - 1]!)]
}

/** A week reached its plan: the same 90% that counts it as on plan. */
export const onPlan = (r: WeekRow) => r.planKm !== null && r.planKm > 0 && r.km >= r.planKm * ON_PLAN_SHARE

function WeeklyDistanceCard({ rows, live, onShift, weeklyAvgKm }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void; weeklyAvgKm: number | null }) {
  const s = t.analytics.cards.weekly
  const view = weeklyDistanceView(rows, live ? weeklyAvgKm : null)
  if (!view) return null
  const { last } = view
  const H = 130
  const hasPlan = rows.some((r) => r.planKm !== null)
  // The app's one weekly average is its last 12 finished weeks; a window
  // further back averages its own.
  const avgWeeks = live && weeklyAvgKm !== null ? 12 : rows.filter((r) => !r.current).length
  return (
    <Card className="gap-3.5" testId="weekly-card">
      <CardHead title={s.title} caption={hasPlan ? s.caption : undefined} about={s.about} />
      <StatGrid columns={view.onPlan ? 3 : 2}>
        <Stat
          size="lg"
          label={last.current ? s.thisWeek : s.weekOf(bare(last.week))}
          value={formatRanKm(last.km)}
          unit={last.planKm !== null ? s.ofPlan(formatKm(last.planKm)) : t.units.km}
        />
        {view.avg !== null && <Stat size="lg" label={s.avgWeeks(avgWeeks)} value={formatKm(view.avg)} unit={s.perWeek} />}
        {view.onPlan && <Stat size="lg" label={s.onPlan} value={view.onPlan.hit} unit={s.ofPlanned(view.onPlan.of)} />}
      </StatGrid>
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => {
          const r = rows[i]!
          return `${t.analytics.cards.scrubWeek(bare(r.week))} · ${formatRanKm(r.km)}${r.planKm !== null ? ` / ${formatKm(r.planKm)}` : ''} ${t.units.km}`
        }}
      >
        <div className="grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 6 }} data-testid="weekly-bars">
          {rows.map((r) => {
            const current = r.current && live
            return (
              <div key={r.week} className="relative flex flex-col justify-end" style={{ height: H }}>
                {r.planKm !== null && (
                  // The plan, a 2 pt text line a little wider than its bar.
                  <div className="absolute -inset-x-0.5 z-[1] h-0.5 rounded-[2px] bg-foreground" style={{ bottom: Math.min(H, (r.planKm / view.yMax) * H) }} data-testid="plan-tick" />
                )}
                {r.km > 0 ? (
                  <div
                    data-current={current ? '' : undefined}
                    data-on-plan={onPlan(r) ? '' : undefined}
                    className="box-border rounded-[5px_5px_2px_2px]"
                    style={{
                      height: Math.max(3, (r.km / view.yMax) * H),
                      background: onPlan(r) ? ACCENT : ACCENT_SOFT,
                      outline: current ? THIS_WEEK_BORDER : undefined,
                      outlineOffset: current ? 2 : undefined,
                    }}
                  />
                ) : current ? (
                  <div data-current="" className="box-border h-[3px] rounded-[2px]" style={{ borderTop: THIS_WEEK_BORDER }} />
                ) : (
                  <EmptyWeek />
                )}
              </div>
            )
          })}
        </div>
      </ChartScrub>
      <div className="flex flex-col gap-2.5">
        <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
        <Legend className="gap-x-4">
          {hasPlan && <LegendItem swatch="square" color={ACCENT}>{s.onOrAbove}</LegendItem>}
          <LegendItem swatch="square" color={ACCENT_SOFT}>{hasPlan ? s.belowPlan : s.done}</LegendItem>
          {hasPlan && <LegendItem swatch="line" color="var(--foreground)">{s.plan}</LegendItem>}
        </Legend>
      </div>
    </Card>
  )
}

/**
 * Year to date as a row that opens Goals, its home (design review, Oct 2026).
 * A full card here was a second copy with words of its own - "132 km short
 * at your current 31 km/week" where Goals says "132 km short at this pace".
 * The row takes Goals' figures and Goals' sentences, its verdict in Goals'
 * tone; last year's comparison is the Volume coach read's.
 */
function YtdRow({ ytd }: { ytd: YtdInput }) {
  const p = t.goals.projection
  const { km, goalKm: goal, projection } = ytd
  const delta = goal !== null && projection ? projection.projectedYearKm - goal : null
  const verdict = delta === null ? null : delta < 0 ? p.shortAtPace(formatKm(Math.abs(delta))) : delta > 0 ? p.overAtPace(formatKm(delta)) : p.onPace
  // Goals' tone for its projection and verdict alike: short is a caution.
  const tone = delta !== null && delta < 0 ? 'var(--warn)' : 'var(--pos)'
  const reached = goal !== null && km >= goal ? t.goals.reached(formatKm(Math.round(km - goal))) : null
  return (
    <Link
      href="/goals"
      className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
      data-testid="ytd-link"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[15px] font-semibold leading-snug text-foreground">{t.analytics.cards.ytd.title}</span>
          <span className="text-[15px] font-semibold leading-snug text-foreground" data-testid="ytd-km">
            {formatKm(km)}
            <Unit>{goal !== null ? t.goals.ofKm(formatKm(goal)) : t.units.km}</Unit>
          </span>
        </span>
        {projection && verdict ? (
          <span className="text-xs text-muted-foreground text-pretty" data-testid="ytd-projection">
            <span style={{ color: tone }} data-testid="ytd-projected">
              {p.projectedMark(formatKm(projection.projectedYearKm))}
            </span>
            {' · '}
            <b className="font-semibold" style={{ color: tone }} data-testid="ytd-verdict">
              {verdict}
            </b>
          </span>
        ) : (
          reached && (
            <span className="text-xs font-semibold text-[var(--pos)]" data-testid="ytd-verdict">
              {reached}
            </span>
          )
        )}
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}

/** The long run chart's top: at least half the week, so the 35% guide sits in its lower two thirds. */
const LONG_RUN_TOP = 0.55

function LongRunCard({ rows, live, onShift }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.longRun
  const view = longRunView(rows)
  if (!view) return null
  const H = 90
  // Each bar is the long run's share of its week (v4.17), against the 35% rule.
  const shares = rows.map((r, i) => (r.km > 0 ? view.bars[i]!.km / r.km : 0))
  const top = Math.max(LONG_RUN_TOP, ...shares)
  return (
    <Card testId="long-run-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Sentence>
        {s.rule}
        <b style={view.over ? { color: 'var(--warn)' } : undefined}>{s.over(view.over)}</b>
      </Sentence>
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => `${t.analytics.cards.scrubWeek(bare(rows[i]!.week))} · ${formatRanKm(view.bars[i]!.km)} ${t.units.km}${shares[i] ? ` · ${Math.round(shares[i]! * 100)}%` : ''}`}
      >
        <div className="relative grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 6 }} data-testid="long-run-bars">
          {/* The 35% rule as a dashed guide across the weeks, over the bars;
              out of the grid, it takes no week's cell. */}
          <div aria-hidden className="pointer-events-none absolute z-[1] inset-x-0 border-t border-dashed border-muted-foreground" style={{ bottom: (LONG_RUN_SHARE / top) * H }} data-testid="long-run-guide" />
          {view.bars.map((bar, i) => {
            const current = bar.current && live
            return bar.km > 0 ? (
              <div
                key={rows[i]!.week}
                data-over={bar.over ? '' : undefined}
                data-current={current ? '' : undefined}
                className="box-border rounded-[5px_5px_2px_2px]"
                style={{
                  height: Math.max(3, (shares[i]! / top) * H),
                  // Over the share is caution; the week under way is never
                  // over (its first runs are its whole distance so far) and
                  // keeps the dashed "this week" outline.
                  background: bar.over ? 'var(--warn)' : 'color-mix(in srgb, var(--accent) 45%, transparent)',
                  outline: current ? THIS_WEEK_BORDER : undefined,
                  outlineOffset: current ? 2 : undefined,
                }}
              />
            ) : (
              <EmptyWeek key={rows[i]!.week} />
            )
          })}
        </div>
      </ChartScrub>
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
    </Card>
  )
}

export interface VolumeTabProps {
  rows: WeekRow[]
  live: boolean
  onShift: (step: 1 | -1) => void
  ytd: YtdInput | null
  weeklyAvgKm: number | null
}

export function VolumeTab({ rows, live, onShift, ytd, weeklyAvgKm }: VolumeTabProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <WeeklyDistanceCard rows={rows} live={live} onShift={onShift} weeklyAvgKm={weeklyAvgKm} />
      <LongRunCard rows={rows} live={live} onShift={onShift} />
      {/* A way out to Goals, last, as Intensity's to the zone table. */}
      {ytd && <YtdRow ytd={ytd} />}
    </div>
  )
}
