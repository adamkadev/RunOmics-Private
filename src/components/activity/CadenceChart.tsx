'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { formatElapsed } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  avgCadence?: number | null
  durationSeconds?: number
  onHoverFraction?: (fraction: number | null) => void
}

export function CadenceChart({ samples, avgCadence, durationSeconds, onHoverFraction }: Props) {
  const data = samples.map((spm, i) => {
    const pct = durationSeconds ? (i / (samples.length - 1)) * durationSeconds : i
    return { t: pct, spm }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const minVal = Math.max(0, Math.min(...samples) - 10)
  const maxVal = Math.max(...samples) + 10

  function formatX(val: number) {
    if (!durationSeconds) return String(val)
    return formatElapsed(val)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.cadence}</h3>
        {avgCadence && (
          <span className="text-xs text-subtle">
            {t.activity.charts.avg} <span className="font-semibold text-foreground">{avgCadence.toFixed(0)}</span>
            {' '}{t.units.spm}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
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
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={5}
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v} ${t.units.spm}`, t.activity.charts.cadence]}
            labelFormatter={(v) => formatX(Number(v))}
          />
          {avgCadence && (
            <ReferenceLine
              y={avgCadence}
              stroke={CHART_COLORS.cadence}
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}
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
    </div>
  )
}
