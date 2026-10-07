'use client'

import { formatDate, formatDelta, formatKm, formatRanKm } from '@/lib/formatters'
import { deltaColor } from '@/lib/deltaTone'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, EmptyWeek, Headline, Legend, LegendItem, Sentence, THIS_WEEK_BORDER } from './AnalyticsKit'
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
      <StatGrid columns={view.onPlan ? 3 : 2} className="gap-3 sm:gap-4">
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
                      // The week under way is dashed: not a week's distance yet.
                      background: current ? 'transparent' : onPlan(r) ? ACCENT : ACCENT_SOFT,
                      border: current ? THIS_WEEK_BORDER : undefined,
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

function YtdCard({ ytd }: { ytd: YtdInput }) {
  const s = t.analytics.cards.ytd
  const km = ytd.current.at(-1)?.km ?? 0
  const prevTotal = ytd.previous.at(-1)?.km ?? 0
  const top = Math.max(ytd.goalKm ?? 0, prevTotal, km, 100)
  // A tenth of headroom over the highest line.
  const yMax = top * 1.08
  const W = 1000
  const H = 120
  const X = (d: number) => (d / ytd.daysInYear) * W
  const Y = (v: number) => H - (v / yMax) * H
  const path = (points: { day: number; km: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p.km).toFixed(1)}`).join('')
  const lastYear = ytd.year - 1
  const vs = ytd.vsLastYear
  const p = ytd.projection
  const goal = ytd.goalKm
  const months = [1, 4, 7, 10, 12].map((m) => formatDate(`2000-${String(m).padStart(2, '0')}-01`, { precision: 'month', year: 'never' }))
  return (
    <Card testId="ytd-card">
      <CardHead title={s.title} caption={vs ? s.caption : undefined} about={s.about} />
      <Headline
        value={formatKm(km)}
        unit={t.units.km}
        note={
          vs ? (
            // Coloured by what it means: ahead of last year is good news.
            <span data-testid="ytd-delta" style={{ color: deltaColor('distance', vs.km - vs.lastYearKm, { value: vs.km }) }}>
              {/* A history that starts in the middle of last year is compared
                  from that date in both years, and says so (v4.16.4). */}
              {vs.since ? s.vsSince(formatDelta(vs.km - vs.lastYearKm), lastYear, bare(vs.since)) : s.vs(formatDelta(vs.km - vs.lastYearKm), lastYear)}
            </span>
          ) : undefined
        }
      />
      <div className="relative">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          {goal && <line x1="0" y1={H} x2={W} y2={Y(goal)} stroke="var(--muted-foreground)" strokeWidth="1.2" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" data-testid="ytd-goal" />}
          {ytd.previous.length > 1 && <path d={path(ytd.previous)} fill="none" stroke="var(--line-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          <path d={path(ytd.current)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-testid="ytd-line" />
        </svg>
        {/* Where this year's line ends, in HTML so it stays round. */}
        <span
          aria-hidden
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${(ytd.todayDay / ytd.daysInYear) * 100}%`, top: Y(km) }}
          data-testid="ytd-today"
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <AxisLabels labels={months} />
        <Legend className="gap-x-4">
          <LegendItem swatch="line" color="var(--accent)">{ytd.year}</LegendItem>
          {ytd.previous.length > 1 && <LegendItem swatch="line" color="var(--line-2)">{lastYear}</LegendItem>}
          {goal && <LegendItem swatch="dash" color="var(--muted-foreground)">{s.goal(formatKm(goal))}</LegendItem>}
        </Legend>
      </div>
      {goal && (
        <p className="mt-0.5 border-t border-border pt-3 text-sm text-[var(--text-2)]" data-testid="ytd-footer">
          {km >= goal ? (
            <b className="font-semibold text-[var(--pos)]">{s.reached(formatKm(km - goal))}</b>
          ) : p && p.projectedYearKm < goal ? (
            <>
              <b className="font-semibold text-[var(--warn)]">{s.short(formatKm(goal - p.projectedYearKm))}</b>
              {s.shortRest(formatKm(p.weeklyRate), formatKm(p.weeklyNeeded))}
            </>
          ) : p ? (
            s.onTrack(formatKm(p.projectedYearKm), formatKm(p.weeklyRate))
          ) : null}
        </p>
      )}
    </Card>
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
      {ytd && <YtdCard ytd={ytd} />}
      <LongRunCard rows={rows} live={live} onShift={onShift} />
    </div>
  )
}
