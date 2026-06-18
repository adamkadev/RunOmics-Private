'use client'

import { ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TemperaturePoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

function linearRegression(pts: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = pts.length
  if (n < 5) return null
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n
  const ssXX = pts.reduce((s, p) => s + (p.x - meanX) ** 2, 0)
  const ssXY = pts.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0)
  if (ssXX === 0) return null
  return { slope: ssXY / ssXX, intercept: meanY - (ssXY / ssXX) * meanX }
}

function tempColor(c: number): string {
  if (c < 10) return '#60a5fa' // blue-400
  if (c < 18) return '#34d399' // emerald-400
  if (c < 24) return '#fbbf24' // amber-400
  if (c < 30) return '#f97316' // orange-500
  return '#ef4444'             // red-500
}

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: TemperaturePoint }
  if (cx == null || cy == null || payload == null) return null
  return <circle cx={cx} cy={cy} r={4} fill={tempColor(payload.temp)} fillOpacity={0.65} stroke="none" />
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload: TemperaturePoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const label = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
  const tc = t.analytics.charts.temperatureCorrelation.tooltip
  return (
    <TooltipCard label={label}>
      <TooltipRow name={tc.temp} value={`${d.temp}°C`} color={tempColor(d.temp)} />
      <TooltipRow name={tc.pace} value={formatPace(d.pace)} color={CHART_COLORS.pace} />
      <TooltipRow name={tc.distance} value={`${d.km} km`} />
    </TooltipCard>
  )
}

interface Props {
  data: TemperaturePoint[]
}

export function TemperatureCorrelationChart({ data }: Props) {
  const pts = data.map((d) => ({ x: d.temp, y: d.pace }))
  const reg = linearRegression(pts)

  const temps = data.map((d) => d.temp)
  const minTemp = Math.min(...temps)
  const maxTemp = Math.max(...temps)

  const trendLine = reg
    ? [
        { temp: minTemp, pace: Math.round(reg.slope * minTemp + reg.intercept) },
        { temp: maxTemp, pace: Math.round(reg.slope * maxTemp + reg.intercept) },
      ]
    : []

  const slopePer10 = reg ? Math.round(reg.slope * 10) : 0
  const ex = t.analytics.charts.temperatureCorrelation.explains

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.temperatureCorrelation.title}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            type="number"
            dataKey="temp"
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}°`}
          />
          <YAxis
            type="number"
            dataKey="pace"
            reversed
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatPace(v)}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Scatter
            data={data}
            shape={<CustomDot />}
            isAnimationActive={false}
          />
          {trendLine.length === 2 && (
            <Line
              data={trendLine}
              type="linear"
              dataKey="pace"
              stroke={CHART_COLORS.axisTick}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {reg && (
        <ChartExplain
          text={slopePer10 > 3 ? ex.slowing(slopePer10) : ex.stable}
          tone={slopePer10 > 3 ? 'caution' : 'neutral'}
        />
      )}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.temperatureCorrelation.footnote}
      </p>
    </div>
  )
}
