'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { formatDuration, formatPace } from '@/lib/formatters'
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

  const paces = data.points.flatMap((p) => data.distances.map((d) => p[d])).filter((v): v is number => v !== null)
  if (!paces.length) return null

  const min = Math.floor(Math.min(...paces)) - 5
  const max = Math.ceil(Math.max(...paces)) + 5

  const tickDates = new Set(
    data.points.filter((_, i) => i % Math.max(1, Math.floor(data.points.length / 6)) === 0).map((p) => p.date),
  )

  const trend = data.bestTrend
  const reading = trend
    ? trend.improvementSec > 0
      ? s.reading.faster(distanceLabel(trend.distance), formatDuration(trend.improvementSec), formatDuration(trend.currentSec))
      : trend.improvementSec < 0
        ? s.reading.slower(distanceLabel(trend.distance), formatDuration(Math.abs(trend.improvementSec)))
        : s.reading.flat
    : null

  const summary = `${s.title}: ${data.distances
    .map((d) => `${distanceLabel(d)} ${data.latest[d] !== undefined ? formatDuration(data.latest[d]!) : '–'}`)
    .join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">
          {s.title} <span className="font-normal text-subtle">{s.window}</span>
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
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
      </div>

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(date: string) => {
                if (!tickDates.has(date)) return ''
                return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, {
                  day: 'numeric',
                  month: 'short',
                })
              }}
            />
            <YAxis
              domain={[min, max]}
              reversed
              tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip content={<CustomTooltip />} />
            {data.distances.map((distance) => (
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

      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
