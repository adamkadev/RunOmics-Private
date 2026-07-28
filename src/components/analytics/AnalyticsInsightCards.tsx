'use client'

import type { ReactNode } from 'react'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import { formatClock } from '@/lib/formatters'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { t } from '@/i18n'

const VIOLET = CHART_COLORS.efficiency
const SKY = CHART_COLORS.cadence

function linePoints(values: number[]): string {
  if (values.length < 2) return '0,9 80,9'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 80
      const y = 16 - ((v - min) / range) * 14
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function LineSpark({ values, color, invert = false }: { values: number[]; color: string; invert?: boolean }) {
  // `invert` for metrics where lower is better (pace): flip so improvement rises.
  const series = invert ? values.map((v) => -v) : values
  return (
    <svg width="100%" height="18" viewBox="0 0 80 18" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={linePoints(series)}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BarSpark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const n = values.length
  const gap = 4
  const bw = 5
  return (
    <svg width="100%" height="18" viewBox={`0 0 ${n * (bw + gap)} 18`} preserveAspectRatio="none" aria-hidden="true">
      <g fill={color}>
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * 14)
          return <rect key={i} x={i * (bw + gap)} y={16 - h} width={bw} height={h} rx="1.5" opacity={0.6 + 0.4 * (v / max)} />
        })}
      </g>
    </svg>
  )
}

function Card({
  label,
  chip,
  chipTone = 'accent',
  value,
  unit,
  valueColor,
  children,
}: {
  label: string
  chip: string
  chipTone?: 'accent' | 'muted'
  value: string
  unit?: string
  valueColor?: string
  children: ReactNode
}) {
  return (
    <div className="glass-row rounded-[15px] p-[13px]">
      <div className="flex items-start justify-between">
        <span className="text-micro font-bold uppercase tracking-[0.05em] text-subtle">{label}</span>
        <span className={chipTone === 'accent' ? 'text-micro font-semibold text-accent-text' : 'text-micro font-semibold text-subtle'}>
          {chip}
        </span>
      </div>
      <div className="my-[3px] font-display text-title2 font-bold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
        {unit && <span className="text-caption font-medium text-subtle"> {unit}</span>}
      </div>
      {children}
    </div>
  )
}

interface Props {
  vo2maxSeries: VO2maxSeries
  vo2maxTopPercent: number | null
  weeklyTrends: WeeklyTrendPoint[]
  threshold: ThresholdHistoryData | null
  activeDays: number
}

// The four slow-moving reads that say more as a number + sparkline than as a
// full chart: VO2max, easy pace, threshold and consistency. Derives from the
// already-computed series - no new physiology.
export function AnalyticsInsightCards({ vo2maxSeries, vo2maxTopPercent, weeklyTrends, threshold, activeDays }: Props) {
  const s = t.analytics.insightCards
  // Easy pace and consistency are the app's own headline reads, so their sparks
  // follow the accent; VO2max and threshold keep their fixed violet/sky.
  const accent = useAccentUiColor()

  const vo2Points = vo2maxSeries['1y'].length >= 2 ? vo2maxSeries['1y'] : vo2maxSeries['6m']
  const vo2Values = vo2Points.map((p) => p.value)
  const vo2Latest = vo2Values[vo2Values.length - 1] ?? null

  const easyPaces = weeklyTrends.map((w) => w.easyPace).filter((v): v is number => v !== null)
  const easyLatest = easyPaces[easyPaces.length - 1] ?? null
  const easyFirst = easyPaces[0]
  const easyDelta = easyLatest !== null && easyFirst !== undefined ? easyLatest - easyFirst : 0

  const thrPaces = threshold?.points.map((p) => p.thresholdPaceSecPerKm).filter((v): v is number => v !== null) ?? []
  const thrLatest = threshold?.latestPace ?? thrPaces[thrPaces.length - 1] ?? null

  // A coarse 9-bucket activity histogram for the consistency bar-sparkline.
  const buckets = 9
  const perBucket = Math.max(1, Math.ceil(weeklyTrends.length / buckets))
  const consistencyBars = Array.from({ length: buckets }, (_, b) => {
    const slice = weeklyTrends.slice(b * perBucket, (b + 1) * perBucket)
    return slice.filter((w) => w.easyPace !== null || w.ef !== null).length
  })

  return (
    <div className="grid grid-cols-2 gap-[9px]">
      {vo2Latest !== null && (
        <Card
          label={s.vo2max}
          chip={vo2maxTopPercent !== null ? s.topPercent(vo2maxTopPercent) : s.holding}
          value={vo2Latest.toFixed(1)}
          valueColor={VIOLET}
        >
          <LineSpark values={vo2Values} color={VIOLET} />
        </Card>
      )}

      {easyLatest !== null && (
        <Card
          label={s.easyPace}
          chip={easyDelta < -1 ? s.faster(Math.abs(Math.round(easyDelta))) : easyDelta > 1 ? s.slower(Math.round(easyDelta)) : s.holding}
          value={formatClock(easyLatest)}
          unit={t.units.perKm}
        >
          <LineSpark values={easyPaces} color={accent} invert />
        </Card>
      )}

      {thrLatest !== null && (
        <Card
          label={s.threshold}
          chip={s.holding}
          chipTone="muted"
          value={formatClock(thrLatest)}
          unit={t.units.perKm}
        >
          <LineSpark values={thrPaces.length >= 2 ? thrPaces : [thrLatest, thrLatest]} color={SKY} />
        </Card>
      )}

      <Card label={s.consistency} chip={s.excellent} value={String(activeDays)} unit={s.days}>
        <BarSpark values={consistencyBars} color={accent} />
      </Card>
    </div>
  )
}
