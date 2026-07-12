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
import type { MonthlyEasyHard } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface Props {
  data: MonthlyEasyHard[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: MonthlyEasyHard }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  const entry = payload?.[0]?.payload
  if (!active || !entry) return null
  return (
    <TooltipCard label={label}>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.analytics.charts.easyHard.easy(entry.easyPct ?? 0)}</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">{t.analytics.charts.easyHard.hard(entry.hardPct ?? 0)}</p>
    </TooltipCard>
  )
}

export function EasyHardChart({ data }: Props) {
  if (!data.some((d) => d.easyPct !== null)) return null

  const ex = t.analytics.charts.easyHard.explains
  const easyValues = data.map((d) => d.easyPct).filter((v): v is number => v !== null)
  const avgEasy = Math.round(easyValues.reduce((s, v) => s + v, 0) / easyValues.length)
  const explain = avgEasy >= 78 && avgEasy <= 88
    ? ex.balanced(avgEasy)
    : avgEasy < 78
      ? ex.tooHard(avgEasy)
      : ex.tooEasy(avgEasy)
  const summary = `${t.analytics.charts.easyHard.title}: ${explain}`

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.easyHard.title}
      </h3>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.referenceTarget, strokeWidth: 1, strokeDasharray: '4 3' }} />
            <Area
              type="monotone"
              dataKey="easyPct"
              stackId="eh"
              stroke={CHART_COLORS.easy}
              strokeWidth={1.5}
              fill={CHART_COLORS.easy}
              fillOpacity={0.55}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="hardPct"
              stackId="eh"
              stroke={CHART_COLORS.hard}
              strokeWidth={1.5}
              fill={CHART_COLORS.hard}
              fillOpacity={0.55}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <ReferenceLine y={80} stroke={CHART_COLORS.referenceTarget} strokeDasharray="4 3" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartExplain text={explain} />
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.easyHard.footnote}
      </p>
    </GlassSurface>
  )
}
