'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { MonthlyLongRuns } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface Props {
  data: MonthlyLongRuns[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  const point = payload?.[0]
  if (!active || !point) return null
  return (
    <TooltipCard label={label}>
      <p className="text-sm font-semibold text-foreground">
        {t.analytics.charts.longRuns.kmLabel(point.value)}
      </p>
    </TooltipCard>
  )
}

export function LongRunsChart({ data }: Props) {
  const accentColor = useAccentUiColor()
  const nonZero = data.filter((d) => d.longestKm > 0)
  if (nonZero.length === 0) return null

  const avg = Math.round(nonZero.reduce((s, d) => s + d.longestKm, 0) / nonZero.length)
  const explain = avg >= 15
    ? t.analytics.charts.longRuns.explains.good(avg)
    : t.analytics.charts.longRuns.explains.low(avg)
  const summary = `${t.analytics.charts.longRuns.title}: ${explain}`

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">{t.analytics.charts.longRuns.title}</h3>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="longRunGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              unit={` ${t.units.km}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: accentColor, strokeWidth: 1, strokeDasharray: '4 3' }} />
            <ReferenceLine
              y={15}
              stroke={CHART_COLORS.referenceTarget}
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: t.analytics.charts.longRuns.refLine, position: 'insideTopRight', fontSize: 10, fill: CHART_COLORS.referenceTarget }}
            />
            <Area
              type="monotone"
              dataKey="longestKm"
              stroke={accentColor}
              strokeWidth={3}
              fill="url(#longRunGradient)"
              dot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartExplain text={explain} />
    </GlassSurface>
  )
}
