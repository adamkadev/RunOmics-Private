'use client'

import type { FitnessAgeView } from '@/application/usecases/GetFitnessAge'
import { AxisLabels, Card, CardHead, ChartScrub, Headline, windowLabels } from '@/components/analytics/AnalyticsKit'
import { formatDate, formatDecimal } from '@/lib/formatters'
import { linePath } from '@/lib/linePath'
import { t } from '@/i18n'

const W = 1000
const H = 56
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

function Trend({ trend, age }: { trend: FitnessAgeView['trend']; age: number | null }) {
  const values = trend.map((s) => s.years)
  // The real age is on the scale, so the line reads as younger or older than it.
  const scale = age === null ? values : [...values, age]
  const pad = Math.max(0.5, (Math.max(...scale) - Math.min(...scale)) * 0.1)
  const min = Math.min(...scale) - pad
  const max = Math.max(...scale) + pad
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  return (
    <div className="flex flex-col gap-2">
      <ChartScrub count={trend.length} mode="line" readout={(i) => `${bare(trend[i]!.date)} · ${formatDecimal(trend[i]!.years, 1)}`}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden data-testid="fitness-age-trend">
          {age !== null && <line x1="0" x2={W} y1={y(age)} y2={y(age)} stroke="var(--muted-foreground)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" data-testid="fitness-age-real" />}
          <path d={linePath(values, min, max, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {age !== null && (
          <span aria-hidden className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[11px] leading-none text-muted-foreground" style={{ top: `${(y(age) / H) * 100}%` }}>
            {age}
          </span>
        )}
      </ChartScrub>
      <AxisLabels labels={windowLabels(trend.map((s) => s.date), false)} />
    </div>
  )
}

export function FitnessAgeCard({ view }: { view: FitnessAgeView }) {
  const a = t.settings.athlete
  const now = Math.round(view.now)
  const younger = view.age === null ? null : view.age - now
  const band = younger === null ? null : younger > 0 ? a.fitnessAgeBand.younger(younger) : younger < 0 ? a.fitnessAgeBand.older(-younger) : a.fitnessAgeBand.onPar
  const tone = younger === null || younger === 0 ? 'var(--muted-foreground)' : younger > 0 ? 'var(--pos)' : 'var(--warn)'
  return (
    <Card testId="fitness-age-card">
      <CardHead
        title={a.fitnessAge}
        caption={view.achievable !== null && <span data-testid="fitness-age-achievable">{a.achievableFitnessAge} <b className="font-semibold text-foreground">{Math.round(view.achievable)}</b></span>}
      />
      <Headline value={now} unit={view.age !== null ? a.ofAge(view.age) : undefined} note={band} noteStyle={{ color: tone }} testId="fitness-age-value" />
      {view.trend.length > 0 && <Trend trend={view.trend} age={view.age} />}
    </Card>
  )
}
