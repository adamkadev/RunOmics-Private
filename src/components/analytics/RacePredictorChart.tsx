'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import { bestTrend } from '@/domain/race/predictionWindow'
import { sampleForRange } from '@/domain/timeWindow'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartRangeChips, ChartWindowPager, useChartWindow } from '@/components/ui/ChartWindowNav'
import { formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

const COLOR: Record<RaceDistanceKey, string> = {
  '5k': CHART_COLORS.efficiency,
  '10k': CHART_COLORS.pace,
  half: CHART_COLORS.brand,
  marathon: CHART_COLORS.atl,
}

function distanceLabel(distance: RaceDistanceKey): string {
  return t.analytics.charts.racePredictor.distances[distance] ?? distance
}

type MarkerShape = 'circle' | 'triangle' | 'square' | 'diamond'

const SHAPE: Record<RaceDistanceKey, MarkerShape> = {
  '5k': 'circle',
  '10k': 'triangle',
  half: 'square',
  marathon: 'diamond',
}

function markerPath(shape: MarkerShape, cx: number, cy: number, r: number) {
  switch (shape) {
    case 'square':
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
    case 'triangle':
      return <polygon points={`${cx},${cy - r - 1} ${cx - r - 1},${cy + r} ${cx + r + 1},${cy + r}`} />
    case 'diamond':
      return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`} />
    default:
      return <circle cx={cx} cy={cy} r={r} />
  }
}

function Marker({ shape, color, size = 4 }: { shape: MarkerShape; color: string; size?: number }) {
  const box = (size + 2) * 2
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="shrink-0" aria-hidden>
      <g fill={color}>{markerPath(shape, box / 2, box / 2, size)}</g>
    </svg>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  value?: number | null
  index?: number
}

function distanceDot(distance: RaceDistanceKey) {
  const Dot = ({ cx, cy, value, index }: DotProps) => {
    if (cx == null || cy == null || value == null) return null
    return (
      <g key={`${distance}-${index}`} fill={COLOR[distance]}>
        {markerPath(SHAPE[distance], cx, cy, 4)}
      </g>
    )
  }
  Dot.displayName = `RaceDot(${distance})`
  return Dot
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

function shortDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload?: { label?: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <TooltipCard label={payload[0]?.payload?.label}>
      {payload.map((p) => {
        const distance = p.dataKey as RaceDistanceKey
        return (
          <TooltipRow
            key={p.dataKey}
            color={COLOR[distance]}
            name={distanceLabel(distance)}
            value={`${formatDuration(Math.round(p.value * RACE_DISTANCE_KM[distance]))} · ${formatPace(p.value)}`}
          />
        )
      })}
    </TooltipCard>
  )
}

export function RacePredictorChart({ data }: { data: GarminRacePredictionsData }) {
  const s = t.analytics.charts.racePredictor

  const { range, selectRange, bounds, visible, canGoBack, canGoForward, goBack, goForward } =
    useChartWindow(data.points)

  // Same point budget as every other windowed chart (4w -> 4, 6m -> 6,
  // 1y -> 12), so the four distance lines read as trends instead of spaghetti.
  // Whole seconds per km: the tooltip renders these as finish times.
  const plotted = sampleForRange(visible, range, 0)

  const distances = data.distances.filter((d) => plotted.some((p) => p[d] !== null))
  const paces = plotted.flatMap((p) => distances.map((d) => p[d])).filter((v): v is number => v !== null)

  const trend = bestTrend(plotted, distances)
  const reading = trend
    ? trend.improvementSec > 0
      ? s.reading.faster(distanceLabel(trend.distance), formatDuration(trend.improvementSec), formatDuration(trend.currentSec))
      : trend.improvementSec < 0
        ? s.reading.slower(distanceLabel(trend.distance), formatDuration(Math.abs(trend.improvementSec)))
        : s.reading.flat
    : null

  const min = paces.length ? Math.floor(Math.min(...paces)) - 5 : 0
  const max = paces.length ? Math.ceil(Math.max(...paces)) + 5 : 0

  const step = Math.max(1, Math.floor(plotted.length / 6))
  const tickDates = new Set(plotted.filter((_, i) => i % step === 0).map((p) => p.date))

  const summary = `${s.title}: ${data.distances
    .map((d) => `${distanceLabel(d)} ${data.latest[d] !== undefined ? formatDuration(data.latest[d]!) : '–'}`)
    .join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <ChartRangeChips value={range} onChange={selectRange} />
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {data.distances.map((distance) => (
          <span key={distance} className="flex items-center gap-1 text-xs text-subtle">
            <Marker shape={SHAPE[distance]} color={COLOR[distance]} size={3} />
            {distanceLabel(distance)}
            {data.latest[distance] !== undefined && (
              <span className="font-semibold text-foreground/80">{formatDuration(data.latest[distance]!)}</span>
            )}
          </span>
        ))}
      </div>

      <ChartWindowPager
        bounds={bounds}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={goBack}
        onForward={goForward}
      />

      {paces.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{s.emptyWindow}</p>
      ) : (
        <ChartFigure summary={summary}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={plotted} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(date: string) => (tickDates.has(date) ? shortDate(date) : '')}
              />
              <YAxis
                domain={[min, max]}
                reversed
                tickFormatter={clock}
                tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                axisLine={false}
                tickLine={false}
                width={46}
              />
              <Tooltip content={<CustomTooltip />} />
              {distances.map((distance) => (
                <Line
                  key={distance}
                  type="linear"
                  dataKey={distance}
                  stroke={COLOR[distance]}
                  strokeWidth={2}
                  dot={distanceDot(distance)}
                  activeDot={{ r: 6, fill: COLOR[distance], stroke: 'none' }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartFigure>
      )}

      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
