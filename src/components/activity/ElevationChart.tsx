'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  samples: number[]
  durationSeconds?: number
  elevationGain?: number | null
  onHoverFraction?: (fraction: number | null) => void
}

export function ElevationChart({ samples, durationSeconds, elevationGain, onHoverFraction }: Props) {
  const data = samples.map((alt, i) => {
    const pct = durationSeconds ? (i / (samples.length - 1)) * durationSeconds : i
    return { t: pct, alt: Math.round(alt) }
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
    const secs = Math.round(val)
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`
  }

  const tickCount = 5

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">Elevation</h3>
        {elevationGain != null && (
          <span className="text-xs text-subtle">
            +<span className="font-semibold text-stone-500">{elevationGain}</span> m gain
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
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
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={tickCount}
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
            width={36}
            tickFormatter={(v: number) => `${v}m`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v} m`, 'Altitude']}
            labelFormatter={(v) => formatX(Number(v))}
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
    </div>
  )
}
