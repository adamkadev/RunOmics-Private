'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { DistanceBracket } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { t } from '@/i18n'

interface Props {
  data: DistanceBracket[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: DistanceBracket }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <TooltipCard label={d.label}>
      <p className="text-sm font-semibold text-foreground">{t.common.runs(d.count)}</p>
      <p className="text-xs text-subtle">{t.analytics.charts.distance.kmTotal(d.km)}</p>
    </TooltipCard>
  )
}

export function DistanceDistributionChart({ data }: Props) {
  const accentColor = useAccentUiColor()
  const max = Math.max(...data.map((d) => d.count))
  const summary = `${t.analytics.charts.distance.title}: ${data.map((d) => `${d.label} ${t.common.runs(d.count)}`).join(', ')}`
  const totalCount = data.reduce((s, d) => s + d.count, 0)
  const top = data.reduce((a, b) => (b.count > a.count ? b : a))
  const reading = totalCount > 0
    ? t.analytics.charts.distance.reading(top.label, Math.round((top.count / totalCount) * 100))
    : null

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.distance.title}</h3>
        <span className="text-xs text-subtle">{t.analytics.charts.distance.runs(data.reduce((s, d) => s + d.count, 0))}</span>
      </div>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
          >
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={56}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={accentColor}
                  fillOpacity={0.45 + 0.55 * (entry.count / max)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">Color intensity reflects relative frequency.</p>
    </GlassSurface>
  )
}
