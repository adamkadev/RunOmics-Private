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
  avgCadence?: number | null
  distanceKm?: number
  onHoverFraction?: (fraction: number | null) => void
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

const CADENCE_CAP = 100
const CADENCE_TICKS = [CADENCE_CAP, 120, 140, 160, 180]
const CADENCE_DOMAIN: [number, number] = [90, 200]

function formatCadenceTick(v: number): string {
  return v === CADENCE_CAP ? '<100' : String(v)
}

function formatCadenceTooltip(spm: number): string {
  return spm <= CADENCE_CAP ? `<100 ${t.units.spm}` : `${spm} ${t.units.spm}`
}

export const CadenceChart = memo(function CadenceChart({ samples, avgCadence, distanceKm, onHoverFraction }: Props) {
  const data = samples.map((spm, i) => {
    const d = distanceKm != null ? (i / (samples.length - 1)) * distanceKm : i
    return { d, spm: Math.max(spm, CADENCE_CAP) }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const maxSpm = Math.max(...samples)
  const summary = `${t.activity.charts.cadence}: ${
    avgCadence ? `${t.activity.charts.avg} ${avgCadence.toFixed(0)}, ` : ''
  }${t.activity.charts.max} ${maxSpm} ${t.units.spm}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.cadence}</h3>
        <span className="text-xs text-subtle">
          {avgCadence && <>{t.activity.charts.avg} <span className="font-semibold text-foreground">{avgCadence.toFixed(0)}</span></>}
          {' · '}{t.activity.charts.max} <span className="font-semibold text-foreground">{maxSpm}</span>
          {' '}{t.units.spm}
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
              <linearGradient id="cadenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.cadence} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.cadence} stopOpacity={0.02} />
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
              domain={CADENCE_DOMAIN}
              ticks={CADENCE_TICKS}
              interval={0}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={formatCadenceTick}
            />
            <Tooltip
              content={
                <SingleSeriesTooltip
                  dataKey="spm"
                  color={CHART_COLORS.cadence}
                  name={t.activity.charts.cadence}
                  formatValue={formatCadenceTooltip}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="spm"
              stroke={CHART_COLORS.cadence}
              strokeWidth={1.5}
              fill="url(#cadenceGradient)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
})
