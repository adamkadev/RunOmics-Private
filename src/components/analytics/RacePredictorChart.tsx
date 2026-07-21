'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import {
  PREDICTION_RANGES,
  bestTrend,
  hasEarlierPoints,
  pointsInWindow,
  windowBounds,
  type PredictionRange,
} from '@/domain/race/predictionWindow'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { formatDuration, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Same hue order as the Goals race cards (violet 5k -> blue 10k -> emerald half
// -> orange marathon), so a distance keeps its identity across the app.
const COLOR: Record<RaceDistanceKey, string> = {
  '5k': CHART_COLORS.efficiency,
  '10k': CHART_COLORS.pace,
  half: CHART_COLORS.brand,
  marathon: CHART_COLORS.atl,
}

// The i18n table is keyed loosely (it is shared shape across locales), so the
// distance key doubles as the fallback label.
function distanceLabel(distance: RaceDistanceKey): string {
  return t.analytics.charts.racePredictor.distances[distance] ?? distance
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

function shortDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <TooltipCard label={label}>
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

  const [range, setRange] = useState<PredictionRange>('4w')
  // 0 is the window ending today; each step back is one window earlier.
  const [offset, setOffset] = useState(0)

  // Anchored on the freshest reading rather than the wall clock, so a stale
  // sync still opens on a window that has data in it.
  const anchor = useMemo(
    () => new Date((data.latestDate ?? data.points[data.points.length - 1]?.date ?? '') + 'T00:00:00'),
    [data.latestDate, data.points],
  )

  const bounds = useMemo(() => windowBounds(range, offset, anchor), [range, offset, anchor])
  const visible = useMemo(() => pointsInWindow(data.points, bounds), [data.points, bounds])

  const canGoBack = hasEarlierPoints(data.points, bounds)
  const canGoForward = offset > 0

  function selectRange(next: PredictionRange) {
    setRange(next)
    setOffset(0)
  }

  const distances = data.distances.filter((d) => visible.some((p) => p[d] !== null))
  const paces = visible.flatMap((p) => distances.map((d) => p[d])).filter((v): v is number => v !== null)

  const trend = bestTrend(visible, distances)
  const reading = trend
    ? trend.improvementSec > 0
      ? s.reading.faster(distanceLabel(trend.distance), formatDuration(trend.improvementSec), formatDuration(trend.currentSec))
      : trend.improvementSec < 0
        ? s.reading.slower(distanceLabel(trend.distance), formatDuration(Math.abs(trend.improvementSec)))
        : s.reading.flat
    : null

  const min = paces.length ? Math.floor(Math.min(...paces)) - 5 : 0
  const max = paces.length ? Math.ceil(Math.max(...paces)) + 5 : 0

  const step = Math.max(1, Math.floor(visible.length / 6))
  const tickDates = new Set(visible.filter((_, i) => i % step === 0).map((p) => p.date))

  const summary = `${s.title}: ${data.distances
    .map((d) => `${distanceLabel(d)} ${data.latest[d] !== undefined ? formatDuration(data.latest[d]!) : '–'}`)
    .join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <div className="flex gap-1">
          {PREDICTION_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => selectRange(r)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                r === range
                  ? 'bg-accent text-white'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {s.ranges[r]}
            </button>
          ))}
        </div>
      </div>

      {/* "Most recent" - the current estimate, which stays put while paging back
          so an older window is always read against today's value. */}
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {data.distances.map((distance) => (
          <span key={distance} className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[distance] }} />
            {distanceLabel(distance)}
            {data.latest[distance] !== undefined && (
              <span className="font-semibold text-foreground/80">{formatDuration(data.latest[distance]!)}</span>
            )}
          </span>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setOffset(offset + 1)}
          disabled={!canGoBack}
          aria-label={s.previous}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {shortDate(bounds.from)} – {shortDate(bounds.to)}
        </span>
        <button
          onClick={() => setOffset(offset - 1)}
          disabled={!canGoForward}
          aria-label={s.next}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {paces.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{s.emptyWindow}</p>
      ) : (
        <ChartFigure summary={summary}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
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
                  type="monotone"
                  dataKey={distance}
                  stroke={COLOR[distance]}
                  strokeWidth={2}
                  dot={false}
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
