'use client'

import { ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TemperaturePoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS, tempBandColor } from '@/lib/colors'
import { linearRegression } from '@/lib/math'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { LowSignalChip } from '@/components/ui/LowSignalChip'
import { t } from '@/i18n'

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: TemperaturePoint }
  if (cx == null || cy == null || payload == null) return null
  return <circle cx={cx} cy={cy} r={4} fill={tempBandColor(payload.temp)} fillOpacity={0.65} stroke="none" />
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload: TemperaturePoint }>
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const label = new Date(d.date + 'T12:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const tc = t.analytics.charts.temperatureCorrelation.tooltip
  return (
    <TooltipCard label={label}>
      <TooltipRow name={tc.temp} value={`${d.temp}°C`} color={tempBandColor(d.temp)} />
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
  const isSignal = reg !== null && slopePer10 > 3
  const ex = t.analytics.charts.temperatureCorrelation.explains
  const summary = `${t.analytics.charts.temperatureCorrelation.title}${
    reg ? `: ${isSignal ? ex.slowing(slopePer10) : ex.stable}` : ''
  }`

  const chart = (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.temperatureCorrelation.title}
      </h3>
      <ChartFigure summary={summary}>
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
      </ChartFigure>
      {reg && (
        <ChartExplain
          text={isSignal ? ex.slowing(slopePer10) : ex.stable}
          tone={isSignal ? 'caution' : 'neutral'}
        />
      )}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.temperatureCorrelation.footnote}
      </p>
    </GlassSurface>
  )

  if (isSignal) return chart

  return (
    <LowSignalChip title={t.analytics.charts.temperatureCorrelation.title} summary={ex.stable}>
      {chart}
    </LowSignalChip>
  )
}
