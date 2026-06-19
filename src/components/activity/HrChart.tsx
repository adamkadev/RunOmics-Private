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
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  avgHr?: number | null
  distanceKm?: number
  onHoverFraction?: (fraction: number | null) => void
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

const HR_TICKS = [100, 120, 140, 160, 180]
const HR_DOMAIN: [number, number] = [80, 200]

export function HrChart({ samples, avgHr, distanceKm, onHoverFraction }: Props) {
  const maxHr = Math.max(...samples)
  const data = samples.map((bpm, i) => {
    const d = distanceKm != null ? (i / (samples.length - 1)) * distanceKm : i
    return { d, bpm }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  return (
    <Card accent="red" padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.heartRate}</h3>
        {avgHr && (
          <span className="text-xs text-subtle">
            {t.activity.charts.avg} <span className="font-semibold text-red-500 dark:text-red-400">{avgHr}</span>
            {' · '}{t.activity.charts.max} <span className="font-semibold text-red-600 dark:text-red-400">{maxHr}</span>
            {' '}{t.units.bpm}
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
            <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.hr} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CHART_COLORS.hr} stopOpacity={0.02} />
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
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v} ${t.units.bpm}`, t.activity.charts.hr]}
            labelFormatter={(v) => `${Number(v).toFixed(1)} km`}
          />
          <Area
            type="monotone"
            dataKey="bpm"
            stroke={CHART_COLORS.hr}
            strokeWidth={1.5}
            fill="url(#hrGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
