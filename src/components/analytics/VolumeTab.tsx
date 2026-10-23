'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatKm, formatPercent, formatRanKm } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, EmptyWeek, Legend, LegendItem, THIS_WEEK_BORDER } from './AnalyticsKit'
import { LONG_RUN_SHARE, ON_PLAN_SHARE, longRunView, weeklyDistanceView, type WeekRow, type YtdInput } from './analyticsView'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A week the plan never asked for is a neutral grey, so "below plan" and "unplanned" never share a swatch. */
const ACCENT = 'var(--accent)'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent) 40%, var(--background))'
const UNPLANNED = 'var(--neutral-bar)'
const MISSED_OUTLINE = '1.5px dashed var(--axis-text)'

/** With no plan anywhere there is nothing to be off, and every week is simply a week that was run. */
const unplanned = (r: WeekRow, hasPlan: boolean) => hasPlan && r.planKm === null

const missedWeek = (r: WeekRow) => r.km === 0 && r.planKm !== null && r.planKm > 0

export function weekLabels(weeks: string[], live: boolean): string[] {
  const n = weeks.length
  if (!n) return []
  const step = Math.max(1, Math.ceil(n / 3))
  const picks = [0, step, step * 2].filter((i) => i < n - 1)
  return [...picks.map((i) => bare(weeks[i]!)), live ? t.analytics.cards.thisWeek : bare(weeks[n - 1]!)]
}

export const onPlan = (r: WeekRow) => r.planKm !== null && r.planKm > 0 && r.km >= r.planKm * ON_PLAN_SHARE

function VolumeStat({ value, of, label, testId }: { value: string | number; of?: string | number; label: string; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <span className="text-2xl font-bold leading-tight text-foreground">
        {value}
        {of != null && <span className="text-sm font-normal text-muted-foreground"> / {of}</span>}
      </span>
      <span className="text-[11.5px] text-muted-foreground text-pretty">{label}</span>
    </div>
  )
}

function WeeklyDistanceCard({ rows, live, onShift, weeklyAvgKm }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void; weeklyAvgKm: number | null }) {
  const s = t.analytics.cards.weekly
  const view = weeklyDistanceView(rows, live ? weeklyAvgKm : null)
  if (!view) return null
  const { last } = view
  const wide = rows.length > 20
  const H = wide ? 150 : 110
  const gap = wide ? 2 : 5
  const radius = wide ? 2 : 4
  // At a year (52 bars) the plan ticks and the missed and planned outlines are noise: the bars' colours alone say
  // on, below or off plan.
  const marks = !wide
  const hasPlanned = marks && live && rows.some((r) => r.current && r.km === 0 && r.planKm !== null)
  const hasPlan = rows.some((r) => r.planKm !== null)
  const hasMissed = marks && rows.some(missedWeek)
  const hasUnplanned = rows.some((r) => r.km > 0 && unplanned(r, hasPlan))
  // The app's one weekly average is its last 12 finished weeks; a window
  // further back averages its own.
  const avgWeeks = live && weeklyAvgKm !== null ? 12 : rows.filter((r) => !r.current).length
  const when = last.current ? s.thisWeek : s.weekOf(bare(last.week))
  return (
    <Card className="gap-3.5" testId="weekly-card">
      <CardHead title={s.title} caption={hasPlan ? s.caption : undefined} about={s.about} />
      <div className="grid grid-cols-3 gap-2.5" data-testid="weekly-stats">
        <VolumeStat value={formatRanKm(last.km)} of={last.planKm !== null ? formatKm(last.planKm) : undefined} label={s.underWeek(when)} />
        {view.avg !== null && <VolumeStat value={formatKm(view.avg)} label={s.underAvg(avgWeeks)} />}
        {view.onPlan && <VolumeStat value={view.onPlan.hit} of={view.onPlan.of} label={s.underOnPlan} />}
      </div>
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => {
          const r = rows[i]!
          return `${t.analytics.cards.scrubWeek(bare(r.week))} · ${formatRanKm(r.km)}${r.planKm !== null ? ` / ${formatKm(r.planKm)}` : ''} ${t.units.km}`
        }}
      >
        <div className="grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap }} data-testid="weekly-bars">
          {rows.map((r) => {
            const current = r.current && live
            const planH = r.planKm !== null ? Math.min(H, (r.planKm / view.yMax) * H) : 0
            return (
              <div key={r.week} className="relative flex flex-col justify-end" style={{ height: H }}>
                {marks && r.planKm !== null && (
                  <div className="absolute inset-x-0 z-[1] h-0.5 bg-foreground" style={{ bottom: planH }} data-testid="plan-tick" />
                )}
                {r.km > 0 ? (
                  <div
                    data-current={current ? '' : undefined}
                    data-on-plan={onPlan(r) ? '' : undefined}
                    className="box-border"
                    style={{
                      borderRadius: radius,
                      height: Math.max(3, (r.km / view.yMax) * H),
                      background: onPlan(r) ? ACCENT : unplanned(r, hasPlan) ? UNPLANNED : ACCENT_SOFT,
                      outline: current ? THIS_WEEK_BORDER : undefined,
                      outlineOffset: current ? 1 : undefined,
                    }}
                  />
                ) : marks && current ? (
                  <div data-current="" className="box-border" style={{ borderRadius: radius, height: Math.max(3, planH), border: THIS_WEEK_BORDER }} />
                ) : marks && missedWeek(r) ? (
                  <div aria-hidden data-testid="empty-week" data-missed="" className="box-border" style={{ borderRadius: radius, height: Math.max(6, planH), border: MISSED_OUTLINE }} />
                ) : (
                  <EmptyWeek />
                )}
              </div>
            )
          })}
        </div>
      </ChartScrub>
      <div className="flex flex-col gap-2.5">
        <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} className="text-[11px] text-[var(--axis-text)]" />
        <Legend className="gap-x-3.5 gap-y-2 text-[var(--text-2)]">
          {hasPlan && <LegendItem swatch="square" size={9} color={ACCENT}>{s.onOrAbove}</LegendItem>}
          <LegendItem swatch="square" size={9} color={ACCENT_SOFT}>{hasPlan ? s.belowPlan : s.done}</LegendItem>
          {hasUnplanned && <LegendItem swatch="square" size={9} color={UNPLANNED}>{s.unplanned}</LegendItem>}
          {hasMissed && <LegendItem swatch="dashRing" size={9} color="var(--muted-foreground)">{s.missed}</LegendItem>}
          {hasPlanned && <LegendItem swatch="dashRing" size={9} color="var(--accent)">{s.planned}</LegendItem>}
          {marks && hasPlan && <LegendItem swatch="line" color="var(--foreground)">{s.plan}</LegendItem>}
        </Legend>
      </div>
    </Card>
  )
}

/** Goals' figures, sentences and tone, so the two pages never word the same projection differently. */
function YtdRow({ ytd }: { ytd: YtdInput }) {
  const p = t.goals.projection
  const { km, goalKm: goal, projection } = ytd
  const delta = goal !== null && projection ? projection.projectedYearKm - goal : null
  // "74 km short of 2,000 at this pace".
  const verdict =
    delta === null || goal === null
      ? null
      : delta < 0
        ? t.analytics.cards.ytd.shortOf(formatKm(Math.abs(delta)), formatKm(goal))
        : delta > 0
          ? t.analytics.cards.ytd.overOf(formatKm(delta), formatKm(goal))
          : p.onPace
  const tone = delta !== null && delta < 0 ? 'var(--warn)' : 'var(--pos)'
  const reached = goal !== null && km >= goal ? t.goals.reached(formatKm(Math.round(km - goal))) : null
  return (
    <Link
      href="/goals"
      className={cardClass({ className: 'flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]' })}
      data-testid="ytd-link"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-foreground" data-testid="ytd-km">
          {t.analytics.cards.ytd.title} · {formatKm(km)} {t.units.km}
        </span>
        {(verdict ?? reached) && (
          <span className="text-[12.5px]" style={{ color: verdict ? tone : 'var(--pos)' }} data-testid="ytd-verdict">
            {verdict ?? reached}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}

/** The long run chart's top: at least half the week, so the 35% guide sits in its lower two thirds. */
const LONG_RUN_TOP = 0.55

function LongRunCard({ rows, live, onShift }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.longRun
  const view = longRunView(rows)
  if (!view) return null
  const H = 70
  const wide = rows.length > 20
  // Each bar is the long run's share of its week, against the 35% rule.
  const shares = rows.map((r, i) => (r.km > 0 ? view.bars[i]!.km / r.km : 0))
  const top = Math.max(LONG_RUN_TOP, ...shares)
  const counted = view.bars.filter((b) => !b.current).length
  return (
    <Card className="gap-2.5" testId="long-run-card">
      <CardHead
        title={s.title}
        about={s.about}
        caption={<span style={view.over ? { color: 'var(--warn)' } : undefined} data-testid="long-run-over">{s.overOf(view.over, counted)}</span>}
      />
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => `${t.analytics.cards.scrubWeek(bare(rows[i]!.week))} · ${formatRanKm(view.bars[i]!.km)} ${t.units.km}${shares[i] ? ` · ${Math.round(shares[i]! * 100)}%` : ''}`}
      >
        <div className="relative grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: wide ? 2 : 5 }} data-testid="long-run-bars">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-[var(--axis-text)]" style={{ bottom: (LONG_RUN_SHARE / top) * H }} data-testid="long-run-guide">
            <span className="absolute -top-[13px] right-0 text-[11px] leading-none tabular-nums text-muted-foreground" data-testid="long-run-guide-label">
              {formatPercent(LONG_RUN_SHARE * 100)}
            </span>
          </div>
          {view.bars.map((bar, i) => {
            const current = bar.current && live
            return bar.km > 0 ? (
              <div
                key={rows[i]!.week}
                data-over={bar.over ? '' : undefined}
                data-current={current ? '' : undefined}
                className="box-border"
                style={{
                  borderRadius: wide ? 2 : 4,
                  height: Math.max(3, (shares[i]! / top) * H),
                  background: bar.over ? 'var(--warn)' : ACCENT_SOFT,
                  outline: current ? THIS_WEEK_BORDER : undefined,
                  outlineOffset: current ? 1 : undefined,
                }}
              />
            ) : (
              <EmptyWeek key={rows[i]!.week} />
            )
          })}
        </div>
      </ChartScrub>
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
      {ytd && <YtdRow ytd={ytd} />}
    </div>
  )
}
