'use client'

import type { ReactNode } from 'react'
import { CardTitle } from '@/components/ui/SectionLabel'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import { formatClock, formatCompactMonthYear, formatSignedDuration } from '@/lib/formatters'
import { CHART_COLORS, metricDeltaColor } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { t } from '@/i18n'

const VIOLET = CHART_COLORS.efficiency
const SKY = CHART_COLORS.cadence

/** Under a second per kilometre is rounding noise, not a gain or a loss. */
const PACE_NOISE_SEC = 1

/** Two readings is the floor for a "since" delta: one reading has nothing to be since. */
const MIN_DELTA_POINTS = 2

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

/**
 * The chip carries a number or nothing - never an adjective. Two of these four
 * chips used to be hardcoded words ("holding", "excellent") that could not
 * change whatever the data did, and the two that were numeric measured against
 * a baseline they never named. `note` is that baseline, stated.
 */
function Card({
  label,
  chip,
  chipColor,
  note,
  value,
  unit,
  valueColor,
  children,
}: {
  label: string
  chip?: string
  chipColor?: string
  note?: string
  value: string
  unit?: string
  valueColor?: string
  children: ReactNode
}) {
  return (
    <div className="glass-row rounded-[15px] p-[13px]">
      <div className="flex items-start justify-between gap-1.5">
        {/* The chip is the number and never shrinks, so the label is the one
            that gives way at the narrowest widths. */}
        <CardTitle as="span" className="min-w-0 truncate">
          {label}
        </CardTitle>
        {chip && (
          <span
            className="shrink-0 text-micro font-semibold tabular-nums"
            style={{ color: chipColor ?? 'var(--accent-text)' }}
          >
            {chip}
          </span>
        )}
      </div>
      <div className="mt-[3px] font-display text-title2 font-bold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
        {unit && <span className="text-caption font-medium text-subtle"> {unit}</span>}
      </div>
      {note && <div className="text-micro leading-tight text-subtle">{note}</div>}
      <div className="mt-[3px]">{children}</div>
    </div>
  )
}

interface Props {
  vo2maxSeries: VO2maxSeries
  vo2maxTopPercent: number | null
  weeklyTrends: WeeklyTrendPoint[]
  threshold: ThresholdHistoryData | null
  activeDays: number
  heatmapDays: number
}

export function AnalyticsInsightCards({
  vo2maxSeries,
  vo2maxTopPercent,
  weeklyTrends,
  threshold,
  activeDays,
  heatmapDays,
}: Props) {
  const s = t.analytics.insightCards
  const accent = useAccentUiColor()

  const vo2Points = vo2maxSeries['1y'].length >= 2 ? vo2maxSeries['1y'] : vo2maxSeries['6m']
  const vo2Values = vo2Points.map((p) => p.value)
  const vo2Latest = vo2Values[vo2Values.length - 1] ?? null

  // Keep the date with the reading: the delta is meaningless without the month
  // it is measured from, and filtering to a bare number threw that away.
  const easySeries = weeklyTrends.flatMap((w) => (w.easyPace !== null ? [{ date: w.date, pace: w.easyPace }] : []))
  const easyPaces = easySeries.map((w) => w.pace)
  const easyLatest = easyPaces[easyPaces.length - 1] ?? null
  const easyBaseline = easySeries.length >= MIN_DELTA_POINTS ? easySeries[0]! : null
  const easyDelta = easyLatest !== null && easyBaseline ? easyLatest - easyBaseline.pace : null

  const thrSeries =
    threshold?.points.flatMap((p) =>
      p.thresholdPaceSecPerKm !== null ? [{ date: p.date, pace: p.thresholdPaceSecPerKm }] : []
    ) ?? []
  const thrPaces = thrSeries.map((p) => p.pace)
  const thrLatest = threshold?.latestPace ?? thrPaces[thrPaces.length - 1] ?? null
  const thrBaseline = thrSeries.length >= MIN_DELTA_POINTS ? thrSeries[0]! : null
  const thrDelta = thrLatest !== null && thrBaseline ? thrLatest - thrBaseline.pace : null

  // The heatmap is a fixed rolling 52-week window, so its length is the honest
  // denominator for "how many of the days did I run".
  const consistencyPercent = heatmapDays > 0 ? Math.round((activeDays / heatmapDays) * 100) : null

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
          chip={vo2maxTopPercent !== null ? s.topPercent(vo2maxTopPercent) : undefined}
          note={vo2maxTopPercent !== null ? s.vsNorms : undefined}
          value={vo2Latest.toFixed(1)}
          valueColor={VIOLET}
        >
          <LineSpark values={vo2Values} color={VIOLET} />
        </Card>
      )}

      {easyLatest !== null && (
        <Card
          label={s.easyPace}
          chip={easyDelta !== null ? formatSignedDuration(easyDelta) : undefined}
          chipColor={easyDelta !== null ? metricDeltaColor(easyDelta, 'down', PACE_NOISE_SEC) : undefined}
          note={easyBaseline ? s.since(formatCompactMonthYear(easyBaseline.date)) : undefined}
          value={formatClock(easyLatest)}
          unit={t.units.perKm}
        >
          <LineSpark values={easyPaces} color={accent} invert />
        </Card>
      )}

      {thrLatest !== null && (
        <Card
          label={s.threshold}
          chip={thrDelta !== null ? formatSignedDuration(thrDelta) : undefined}
          chipColor={thrDelta !== null ? metricDeltaColor(thrDelta, 'down', PACE_NOISE_SEC) : undefined}
          note={thrBaseline ? s.since(formatCompactMonthYear(thrBaseline.date)) : undefined}
          value={formatClock(thrLatest)}
          unit={t.units.perKm}
        >
          <LineSpark values={thrPaces.length >= 2 ? thrPaces : [thrLatest, thrLatest]} color={SKY} />
        </Card>
      )}

      <Card
        label={s.consistency}
        chip={consistencyPercent !== null ? `${consistencyPercent}${t.units.percent}` : undefined}
        note={consistencyPercent !== null ? s.ofDays(String(heatmapDays)) : undefined}
        value={String(activeDays)}
        unit={s.days}
      >
        <BarSpark values={consistencyBars} color={accent} />
      </Card>
    </div>
  )
}
