'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import { VO2MAX_RANGES, type VO2maxRange } from '@/domain/training/vo2maxRanges'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { trendFromSeries } from '@/lib/chartTrend'
import { t } from '@/i18n'

const COLOR = CHART_COLORS.efficiency // violet-500

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  const point = payload?.[0]
  if (!active || !point) return null
  const s = t.dashboard.vo2maxChart
  return (
    <TooltipCard label={label}>
      <TooltipRow color={COLOR} name="VO₂max" value={`${point.value.toFixed(1)} ${s.unit}`} />
    </TooltipCard>
  )
}

export function VO2maxChart({ series }: { series: VO2maxSeries }) {
  const s = t.dashboard.vo2maxChart
  // Only offer a window that has a line to draw.
  const available = VO2MAX_RANGES.filter((r) => series[r].length >= 2)
  const [range, setRange] = useState<VO2maxRange>(available.includes('6m') ? '6m' : available[0] ?? '1y')

  const data = series[range] ?? []
  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const latestValue = values[values.length - 1] ?? 0
  const min = Math.floor(Math.min(...values)) - 1
  const max = Math.ceil(Math.max(...values)) + 1

  // Show a tick every ~10 points to avoid clutter
  const step = Math.max(1, Math.floor(data.length / 6))
  const tickDates = new Set(data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => d.date))
  const labelByDate = new Map(data.map((d) => [d.date, d.label]))

  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length * 10) / 10
  const summary = `${s.title}: ${min}–${max} ${s.unit}, ${t.activity.charts.avg} ${avg}`
  const trend = trendFromSeries(values, 0.3)
  const reading = trend
    ? trend.direction === 'up' ? s.reading.up(avg) : trend.direction === 'down' ? s.reading.down(avg) : s.reading.flat(avg)
    : null

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">
          {s.title}
          <span className="ml-2 font-bold tabular-nums text-violet-600 dark:text-violet-400">
            {latestValue.toFixed(1)}
            <span className="ml-1 font-normal text-muted-foreground">{s.unit}</span>
          </span>
        </h3>
        {available.length > 1 && (
          <div className="flex gap-1">
            {available.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  r === range
                    ? 'bg-violet-500 text-white'
                    : 'border border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {s.ranges[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(d: string) => (tickDates.has(d) ? labelByDate.get(d) ?? '' : '')}
            />
            <YAxis
              domain={[min, max]}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={32}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <ReferenceLine y={avg} stroke={CHART_COLORS.axisTick} strokeDasharray="3 3" strokeOpacity={0.4} />
            <Tooltip content={<CustomTooltip />} labelFormatter={(d) => labelByDate.get(String(d)) ?? String(d)} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={COLOR}
              strokeWidth={3}
              dot={{ r: 2.5, fill: COLOR, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>

      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
