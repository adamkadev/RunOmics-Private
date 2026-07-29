'use client'

import { memo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { formatClock } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SingleSeriesTooltip } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  avgPaceSecPerKm?: number | null
  distanceKm?: number
  onHoverFraction?: (fraction: number | null) => void
}

const PACE_CAP = 8 * 60 + 15 // 8:15/km
const PACE_TICKS = [480, 420, 360, 300, 240] // 8:00, 7:00, 6:00, 5:00, 4:00

function formatPaceTick(v: number): string {
  return v === PACE_CAP ? '>8:15' : formatClock(v)
}

function formatPaceTooltip(sec: number): string {
  return sec >= PACE_CAP ? `>8:15 /${t.units.km}` : `${formatClock(sec)}/${t.units.km}`
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

export const PaceChart = memo(function PaceChart({ samples, avgPaceSecPerKm, distanceKm, onHoverFraction }: Props) {
  const data = samples.map((pace, i) => {
    const d = distanceKm != null ? (i / (samples.length - 1)) * distanceKm : i
    const clampedPace = pace > 0 ? Math.min(pace, PACE_CAP) : undefined
    return { d, pace: clampedPace }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const validSamples = samples.filter((v) => v > 0)
  const avgPace = avgPaceSecPerKm ?? null
  const bestPace = validSamples.length ? Math.min(...validSamples) : null
  const summary = `${t.activity.charts.pace}: ${
    avgPace ? `${t.activity.charts.avg} ${formatClock(avgPace)}, ` : ''
  }${bestPace ? `${t.activity.charts.max} ${formatClock(bestPace)} ` : ''}${t.trainingZones.perKm}`.trim()

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.pace}</h3>
        <span className="text-xs text-subtle">
          {avgPace && <>{t.activity.charts.avg} <span className="font-semibold text-foreground">{formatClock(avgPace)}</span></>}
          {bestPace && <> · {t.activity.charts.max} <span className="font-semibold text-foreground">{formatClock(bestPace)}</span></>}
          {' '}{t.trainingZones.perKm}
        </span>
      </div>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={140} className="select-none touch-pan-y">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onMouseMove={handleMove}
            onMouseLeave={() => onHoverFraction?.(null)}
          >
            <defs>
              <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.pace} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.pace} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, distanceKm ?? 'dataMax']}
              ticks={distanceKm != null ? kmTicks(distanceKm) : undefined}
              tickFormatter={(v) => (v === 0 ? '' : `${v} km`)}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[PACE_CAP + 15, 175]}
              ticks={PACE_TICKS}
              interval={0}
              reversed
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={formatPaceTick}
            />
            <Tooltip
              content={
                <SingleSeriesTooltip
                  dataKey="pace"
                  color={CHART_COLORS.pace}
                  name={t.activity.charts.pace}
                  formatValue={formatPaceTooltip}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="pace"
              stroke={CHART_COLORS.pace}
              strokeWidth={1.5}
              fill="url(#paceGradient)"
              dot={false}
              baseValue={PACE_CAP + 15}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
})
