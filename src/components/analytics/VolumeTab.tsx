'use client'

import { formatDate, formatDelta, formatKm, formatRanKm, formatWeekday } from '@/lib/formatters'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, EmptyWeek, Headline, Legend, LegendItem, THIS_WEEK_FILL, THIS_WEEK_OUTLINE } from './AnalyticsKit'
import { longRunView, weeklyDistanceView, type WeekRow, type YtdInput } from './analyticsView'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** Four labels under a row of weekly bars: the first, two between, and the last. */
export function weekLabels(weeks: string[], live: boolean): string[] {
  const n = weeks.length
  if (!n) return []
  const step = Math.max(1, Math.ceil(n / 3))
  const picks = [0, step, step * 2].filter((i) => i < n - 1)
  return [...picks.map((i) => bare(weeks[i]!)), live ? t.analytics.cards.thisWeek : bare(weeks[n - 1]!)]
}

function WeeklyDistanceCard({ rows, live, onShift, weeklyAvgKm }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void; weeklyAvgKm: number | null }) {
  const s = t.analytics.cards.weekly
  const view = weeklyDistanceView(rows, live ? weeklyAvgKm : null)
  if (!view) return null
  const { last } = view
  const H = 120
  const hasPlan = rows.some((r) => r.planKm !== null)
  return (
    <Card testId="weekly-card">
      <CardHead title={s.title} caption={hasPlan ? s.caption : undefined} about={s.about} />
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[24px] font-bold leading-none tabular-nums text-foreground">{formatRanKm(last.km)}</span>
          <span className="text-[12px] text-muted-foreground">
            {last.current ? s.thisWeek : s.weekOf(bare(last.week))}
            {last.planKm !== null && s.of(formatKm(last.planKm))}
          </span>
        </div>
        {view.avg !== null && (
          <div className="flex flex-col gap-1">
            <span className="font-display text-[24px] font-bold leading-none tabular-nums text-foreground">{formatKm(view.avg)}</span>
            <span className="text-[12px] text-muted-foreground">{s.avg}</span>
          </div>
        )}
        {view.onPlan && (
          <div className="flex flex-col gap-1">
            <span className="font-display text-[24px] font-bold leading-none tabular-nums text-foreground">
              {view.onPlan.hit} / {view.onPlan.of}
            </span>
            <span className="text-[12px] text-muted-foreground">{s.onPlan}</span>
          </div>
        )}
      </div>
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => {
          const r = rows[i]!
          return `${t.analytics.cards.scrubWeek(bare(r.week))} · ${formatRanKm(r.km)}${r.planKm !== null ? ` / ${formatKm(r.planKm)}` : ''} ${t.units.km}`
        }}
      >
        <div className="grid h-[130px] items-end pt-1.5" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 5 }} data-testid="weekly-bars">
          {rows.map((r) => (
            <div key={r.week} className="relative flex flex-col justify-end" style={{ height: H }}>
              {r.planKm !== null && (
                <div className="absolute -inset-x-px z-[1] h-0.5 rounded-[1px] bg-foreground" style={{ bottom: (r.planKm / view.yMax) * H }} data-testid="plan-tick" />
              )}
              {r.km > 0 ? (
                <div
                  data-current={r.current && live ? '' : undefined}
                  className="rounded-[4px]"
                  style={{
                    height: Math.max(2, (r.km / view.yMax) * H),
                    background: r.current && live ? THIS_WEEK_FILL : 'var(--series-2)',
                    boxShadow: r.current && live ? THIS_WEEK_OUTLINE : undefined,
                  }}
                />
              ) : (
                <EmptyWeek />
              )}
            </div>
          ))}
        </div>
      </ChartScrub>
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
      <Legend>
        <LegendItem swatch="square" color="var(--series-2)">{s.done}</LegendItem>
        {hasPlan && <LegendItem swatch="line" color="var(--foreground)">{s.plan}</LegendItem>}
        {live && <LegendItem swatch="ring" color="var(--accent)">{s.current}</LegendItem>}
      </Legend>
      {/* Under the chart, not a second line in the stat row (v5.5 #23). */}
      {view.onPlan && view.withoutPlan > 0 && (
        <p className="-mt-1 text-[12px] text-muted-foreground" data-testid="weeks-without-plan">{s.withoutPlan(view.withoutPlan)}</p>
      )}
    </Card>
  )
}

function YtdCard({ ytd, today }: { ytd: YtdInput; today: string }) {
  const s = t.analytics.cards.ytd
  const km = ytd.current.at(-1)?.km ?? 0
  const prevTotal = ytd.previous.at(-1)?.km ?? 0
  const top = Math.max(ytd.goalKm ?? 0, prevTotal, km, 100)
  const yMax = Math.ceil(top / 500) * 500
  const W = 311
  const H = 110
  const X = (d: number) => (d / ytd.daysInYear) * W
  const Y = (v: number) => H - (v / yMax) * H
  const path = (points: { day: number; km: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p.km).toFixed(1)}`).join('')
  const lastYear = ytd.year - 1
  const sameDate = `${lastYear}${today.slice(4)}`
  const vs = ytd.vsLastYear
  const p = ytd.projection
  const goal = ytd.goalKm
  const months = [1, 4, 7, 10, 12].map((m) => formatDate(`2000-${String(m).padStart(2, '0')}-01`, { precision: 'month', year: 'never' }))
  return (
    <Card testId="ytd-card">
      <CardHead title={s.title} caption={vs ? (vs.since ? s.captionSince : s.caption) : undefined} about={s.about} />
      <Headline
        value={`${formatKm(km)} ${t.units.km}`}
        note={
          vs ? (
            <span data-testid="ytd-delta">
              <span style={{ color: deltaColor('distance', vs.km - vs.lastYearKm, { value: vs.km }) }}>{formatDelta(vs.km - vs.lastYearKm)}</span>
              {/* A history that starts in the middle of last year is compared
                  from that date in both years, and says so (v4.16.3). */}
              {vs.since ? s.vsSince('', bare(vs.since)) : s.vs('', t.dates.monthShortYear(bare(sameDate), sameDate.slice(2, 4)))}
            </span>
          ) : undefined
        }
      />
      <div className="relative">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          {[0, H / 2, H].map((y) => (
            <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
          ))}
          {goal && <line x1="0" y1={H} x2={W} y2={Y(goal)} stroke="var(--muted-foreground)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" data-testid="ytd-goal" />}
          {ytd.previous.length > 1 && <path d={path(ytd.previous)} fill="none" stroke="var(--series-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          <path d={path(ytd.current)} fill="none" stroke="var(--foreground)" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* The dot in HTML, not the stretched SVG, so it stays round. */}
        <span
          aria-hidden
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${(ytd.todayDay / ytd.daysInYear) * 100}%`, top: Y(km) }}
          data-testid="ytd-today"
        />
      </div>
      <AxisLabels labels={months} />
      <Legend className="text-[12px]">
        <LegendItem swatch="line" color="var(--foreground)">{ytd.year}</LegendItem>
        {ytd.previous.length > 1 && <LegendItem swatch="line" color="var(--series-2)">{lastYear}</LegendItem>}
        {goal && <LegendItem swatch="dash" color="var(--muted-foreground)">{s.goal(formatKm(goal))}</LegendItem>}
      </Legend>
      {goal && (
        <p className="border-t border-[var(--divider)] pt-2.5 text-[13px] text-muted-foreground" data-testid="ytd-footer">
          {km >= goal ? (
            <span className="font-bold text-foreground">{s.reached(formatKm(km - goal))}</span>
          ) : p && p.projectedYearKm < goal ? (
            <>
              <span className="font-bold text-[var(--tone-caution)]">{s.short(formatKm(goal - p.projectedYearKm))}</span>
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

function LongRunCard({ rows, live, today, onShift }: { rows: WeekRow[]; live: boolean; today: string; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.longRun
  const view = longRunView(rows)
  if (!view) return null
  const dayName = view.date ? (view.date === today ? t.analytics.cards.today : formatWeekday(view.date)) : null
  return (
    <Card testId="long-run-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline size={24} value={`${formatRanKm(view.km)} ${t.units.km}`} note={dayName && view.share !== null ? s.share(dayName, view.share) : undefined} />
      <ChartScrub count={rows.length} onShift={onShift} readout={(i) => `${t.analytics.cards.scrubWeek(bare(rows[i]!.week))} · ${formatRanKm(view.bars[i]!.km)} ${t.units.km}`}>
        <div className="grid h-[50px] items-end" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 5 }} data-testid="long-run-bars">
          {view.bars.map((bar, i) =>
            bar.km > 0 ? (
              <div
                key={rows[i]!.week}
                data-over={bar.over ? '' : undefined}
                data-current={bar.current && live ? '' : undefined}
                className="rounded-[3px]"
                style={{
                  height: Math.max(2, (bar.km / view.yMax) * 50),
                  // Over the share is amber whichever week it is; this week keeps its outline.
                  background: bar.over ? 'var(--tone-caution)' : bar.current && live ? THIS_WEEK_FILL : 'var(--band)',
                  boxShadow: bar.current && live ? THIS_WEEK_OUTLINE : undefined,
                }}
              />
            ) : (
              <EmptyWeek key={rows[i]!.week} />
            ),
          )}
        </div>
      </ChartScrub>
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
      <p className="text-[12px] text-muted-foreground">
        {s.rule}
        {s.over(view.over)}
      </p>
    </Card>
  )
}

export interface VolumeTabProps {
  rows: WeekRow[]
  live: boolean
  onShift: (step: 1 | -1) => void
  ytd: YtdInput | null
  today: string
  weeklyAvgKm: number | null
}

export function VolumeTab({ rows, live, onShift, ytd, today, weeklyAvgKm }: VolumeTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <WeeklyDistanceCard rows={rows} live={live} onShift={onShift} weeklyAvgKm={weeklyAvgKm} />
      {ytd && <YtdCard ytd={ytd} today={today} />}
      <LongRunCard rows={rows} live={live} today={today} onShift={onShift} />
    </div>
  )
}
