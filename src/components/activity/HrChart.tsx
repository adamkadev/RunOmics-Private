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
import { CHART_COLORS, ZONE_COLOR_CLASSES } from '@/lib/colors'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SingleSeriesTooltip } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import type { HrZone } from '@/domain/activity/types'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  avgHr?: number | null
  distanceKm?: number
  onHoverFraction?: (fraction: number | null) => void
  highlightZone?: number | null
  hrZones?: HrZone[]
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

// `zones` must already be sorted ascending by minBpm - sorting here would
// re-sort on every sample point instead of once per chart render.
function getZoneForBpm(hr: number, sortedZones: HrZone[]): number {
  let zone = sortedZones[0]?.zone ?? 1
  for (const z of sortedZones) {
    if (hr >= z.minBpm) zone = z.zone
  }
  return zone
}

const HR_TICKS = [100, 120, 140, 160, 180]
const HR_DOMAIN: [number, number] = [80, 200]

export const HrChart = memo(function HrChart({ samples, avgHr, distanceKm, onHoverFraction, highlightZone, hrZones }: Props) {
  const maxHr = Math.max(...samples)
  const sortedZones = hrZones ? [...hrZones].sort((a, b) => a.minBpm - b.minBpm) : null

  const data = samples.map((bpm, i) => {
    const d = distanceKm != null ? (i / (samples.length - 1)) * distanceKm : i
    const inZone = sortedZones && highlightZone != null
      ? getZoneForBpm(bpm, sortedZones) === highlightZone
      : true
    return { d, bpm, highlight: inZone ? bpm : null }
  })

  const isFiltering = highlightZone != null && hrZones && hrZones.length > 0
  const summary = avgHr
    ? `${t.activity.charts.heartRate}: ${t.activity.charts.avg} ${avgHr}, ${t.activity.charts.max} ${maxHr} ${t.units.bpm}`
    : `${t.activity.charts.heartRate}: ${t.activity.charts.max} ${maxHr} ${t.units.bpm}`

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.heartRate}</h3>
        {avgHr && (
          <span className="text-xs text-subtle">
            {t.activity.charts.avg} <span className={`font-semibold ${ZONE_COLOR_CLASSES[5]?.text}`}>{avgHr}</span>
            {' · '}{t.activity.charts.max} <span className={`font-semibold ${ZONE_COLOR_CLASSES[5]?.text}`}>{maxHr}</span>
            {' '}{t.units.bpm}
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
              <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.hr} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.hr} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="hrHighlightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.hr} stopOpacity={0.45} />
                <stop offset="95%" stopColor={CHART_COLORS.hr} stopOpacity={0.05} />
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
              domain={HR_DOMAIN}
              ticks={HR_TICKS}
              interval={0}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={
                <SingleSeriesTooltip
                  dataKey="bpm"
                  color={CHART_COLORS.hr}
                  name={t.activity.charts.hr}
                  formatValue={(v) => `${v} ${t.units.bpm}`}
                />
              }
            />
            {/* Base area - dimmed when filtering by zone */}
            <Area
              type="monotone"
              dataKey="bpm"
              stroke={CHART_COLORS.hr}
              strokeWidth={isFiltering ? 1 : 1.5}
              strokeOpacity={isFiltering ? 0.15 : 1}
              fill={isFiltering ? 'none' : 'url(#hrGradient)'}
              dot={false}
              isAnimationActive={false}
            />
            {/* Highlighted zone overlay */}
            {isFiltering && (
              <Area
                type="monotone"
                dataKey="highlight"
                stroke={CHART_COLORS.hr}
                strokeWidth={1.5}
                fill="url(#hrHighlightGradient)"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
})
