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
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SingleSeriesTooltip } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  distanceKm?: number
  elevationGain?: number | null
  onHoverFraction?: (fraction: number | null) => void
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

const ELEV_STEPS = [5, 10, 15, 20, 25, 50, 100]

function elevationTicks(samples: number[]): { ticks: number[]; domain: [number, number] } {
  const rawMin = Math.min(...samples)
  const rawMax = Math.max(...samples)
  const range = rawMax - rawMin
  const step = ELEV_STEPS.find((s) => range / s <= 8) ?? 100
  const firstTick = Math.floor(rawMin / 5) * 5
  const lastTick = Math.ceil(rawMax / step) * step
  const ticks: number[] = []
  for (let v = firstTick; v <= lastTick; v += step) ticks.push(v)
  return { ticks, domain: [firstTick - step * 0.5, lastTick + step * 0.5] }
}

export const ElevationChart = memo(function ElevationChart({ samples, distanceKm, elevationGain, onHoverFraction }: Props) {
  const data = samples.map((alt, i) => {
    const d = distanceKm != null ? (i / (samples.length - 1)) * distanceKm : i
    return { d, alt: Math.round(alt) }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const { ticks: elevTicks, domain: elevDomain } = elevationTicks(samples)

  const minAlt = Math.round(Math.min(...samples))
  const maxAlt = Math.round(Math.max(...samples))
  const summary = `${t.activity.charts.elevation}: ${minAlt}–${maxAlt} ${t.units.m}${
    elevationGain != null ? ` (+${elevationGain} ${t.units.m})` : ''
  }`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.elevation}</h3>
        {elevationGain != null && (
          <span className="text-xs text-subtle">
            +<span className="font-semibold text-stone-500 dark:text-stone-400">{elevationGain}</span> {t.units.m} gain
          </span>
        )}
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
              <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.elevation} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.elevation} stopOpacity={0.04} />
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
              domain={elevDomain}
              ticks={elevTicks}
              interval={0}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={46}
              tickFormatter={(v: number) => `${v}m`}
            />
            <Tooltip
              content={
                <SingleSeriesTooltip
                  dataKey="alt"
                  color={CHART_COLORS.elevation}
                  name={t.activity.charts.altitude}
                  formatValue={(v) => `${v} ${t.units.m}`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="alt"
              stroke={CHART_COLORS.elevation}
              strokeWidth={1.5}
              fill="url(#elevGradient)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
})
