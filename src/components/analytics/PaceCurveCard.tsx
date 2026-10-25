'use client'

import type { RunBests } from '@/domain/activity/paceCurve'
import { formatClock, formatDate } from '@/lib/formatters'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import { Card, CardHead, ChartScrub, Headline, Legend, LegendItem, Sentence } from './AnalyticsKit'
import { paceCurveView } from './paceCurveView'
import type { DayWindow, LoadPeriod } from './analyticsView'

const W = 1000
const H = 140
const LABELLED = [30, 120, 600, 3600, 7200]
const LEVEL_SEC = 3

const PACE_ROUND = 5

function paceDomain(paces: number[]): { lo: number; hi: number; ticks: [number, number, number] } {
  const min = Math.min(...paces)
  const max = Math.max(...paces)
  const pad = Math.max(5, (max - min) * 0.05)
  const lo = Math.floor((min - pad) / PACE_ROUND) * PACE_ROUND
  const rounded = Math.ceil((max + pad) / PACE_ROUND) * PACE_ROUND
  const hi = (rounded - lo) % (2 * PACE_ROUND) === 0 ? rounded : rounded + PACE_ROUND
  return { lo, hi, ticks: [lo, (lo + hi) / 2, hi] }
}

function Bold({ parts, color }: { parts: [string, string, string]; color?: string }) {
  return (
    <>
      {parts[0]}
      <b style={color ? { color } : undefined}>{parts[1]}</b>
      {parts[2]}
    </>
  )
}

export function PaceCurveCard({ runs, window, period, threshold, onShift }: {
  runs: RunBests[]
  window: DayWindow
  period: LoadPeriod
  threshold: { date: string; pace: number }[]
  onShift: (step: 1 | -1) => void
}) {
  const s = t.analytics.cards.paceCurve
  const view = paceCurveView(runs, window, threshold)
  if (!view) return null
  const { rows, cs } = view
  const first = rows[0]!.seconds
  const last = Math.max(rows.at(-1)!.seconds, 1200)
  const share = (seconds: number) => Math.log(seconds / first) / Math.log(last / first)
  const csPace = cs ? Math.round(cs.paceSecPerKm) : null
  const paces = rows.flatMap((r) => [r.now?.pace, r.before?.pace]).filter((v): v is number => v != null)
  const { lo, hi, ticks } = paceDomain(csPace ? [...paces, csPace] : paces)
  const yOf = (pace: number) => (H * (pace - lo)) / (hi - lo)
  const path = (pick: (r: (typeof rows)[number]) => { pace: number } | null) =>
    rows
      .flatMap((r) => {
        const p = pick(r)
        return p ? [`${(share(r.seconds) * W).toFixed(1)},${yOf(p.pace).toFixed(1)}`] : []
      })
      .map((xy, i) => `${i ? 'L' : 'M'}${xy}`)
      .join('')
  const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
  const thresholdText = view.threshold ? formatClock(view.threshold) : ''
  const gap = view.vsThreshold
  const delta = view.csDelta
  return (
    <Card testId="pace-curve-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      {cs && csPace !== null ? (
        <>
          <Headline value={formatClock(csPace)} unit={t.units.perKm} note={`${s.cs} · ${s.dPrime(Math.round(cs.dPrimeMetres))}`} testId="critical-speed" />
          <Sentence testId="pace-curve-sentence">
            {gap === null ? (
              s.noThreshold
            ) : Math.abs(gap) < LEVEL_SEC ? (
              <Bold parts={s.level(thresholdText)} />
            ) : gap < 0 ? (
              <Bold parts={s.faster(-gap, thresholdText)} />
            ) : (
              <Bold parts={s.slower(gap, thresholdText)} />
            )}
            {delta !== null &&
              (delta === 0 ? (
                <Bold parts={s.held(s.span[period]!)} />
              ) : (
                <Bold parts={s.changed(`${Math.abs(delta)} s`, delta < 0, s.span[period]!)} color={deltaColor('pace', delta)} />
              ))}
          </Sentence>
        </>
      ) : (
        <Sentence testId="pace-curve-sentence">{s.noFit}</Sentence>
      )}
      <div className="flex gap-2 py-1.5">
        <div className="relative w-8 shrink-0 text-[11px] leading-none text-muted-foreground" style={{ height: H }} aria-hidden>
          {ticks.map((pace) => (
            <span key={pace} className="absolute right-0 -translate-y-1/2" style={{ top: `${(yOf(pace) / H) * 100}%` }}>
              {formatClock(pace)}
            </span>
          ))}
        </div>
        <ChartScrub
          className="min-w-0 flex-1"
          count={rows.length}
          mode="line"
          positions={rows.map((r) => share(r.seconds))}
          onShift={onShift}
          readout={(i) => {
            const r = rows[i]!
            return [
              s.duration(r.seconds),
              r.now && `${formatClock(Math.round(r.now.pace))}${t.units.perKm} · ${bare(r.now.date)}`,
              r.before && s.prior(formatClock(Math.round(r.before.pace))),
            ]
              .filter(Boolean)
              .join(' · ')
          }}
        >
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            {ticks.map((pace) => (
              <line key={pace} x1="0" x2={W} y1={yOf(pace)} y2={yOf(pace)} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" />
            ))}
            {csPace !== null && (
              <line x1="0" x2={W} y1={yOf(csPace)} y2={yOf(csPace)} stroke="var(--zone-4)" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" data-testid="cs-line" />
            )}
            <path d={path((r) => r.before)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={path((r) => r.now)} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" data-testid="pace-curve-now" />
          </svg>
          {/* Dots as HTML, so the stretched viewBox does not squash them into ellipses. */}
          {rows.map((r) =>
            r.now ? (
              <span
                key={r.seconds}
                aria-hidden
                className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                style={{ left: `${share(r.seconds) * 100}%`, top: `${(yOf(r.now.pace) / H) * 100}%` }}
              />
            ) : null,
          )}
        </ChartScrub>
      </div>
      <div aria-hidden className="relative ml-10 h-3.5 text-caption leading-none text-muted-foreground">
        {LABELLED.filter((sec) => sec >= first && sec <= last).map((sec) => {
          const at = share(sec)
          return (
            <span key={sec} className="absolute whitespace-nowrap" style={{ left: `${at * 100}%`, transform: at < 0.02 ? undefined : at > 0.98 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {s.duration(sec)}
            </span>
          )
        })}
      </div>
      <Legend className="gap-x-4">
        <LegendItem swatch="line" color="var(--foreground)">{s.now[period]}</LegendItem>
        <LegendItem swatch="dash" color="var(--muted-foreground)">{s.before[period]}</LegendItem>
        {csPace !== null && <LegendItem swatch="dash" color="var(--zone-4)">{s.cs}</LegendItem>}
      </Legend>
    </Card>
  )
}
