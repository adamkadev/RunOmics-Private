'use client'

import {
  BarChart,
  Bar,
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
import type { ExplainTone } from '@/components/ui/ChartExplain'
import { Card } from '@/components/ui/Card'
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
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
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
  const explain: { text: string; tone: ExplainTone } =
    avgEasy >= 78 && avgEasy <= 88
      ? { text: ex.balanced(avgEasy), tone: 'positive' }
      : avgEasy < 78
        ? { text: ex.tooHard(avgEasy), tone: 'caution' }
        : { text: ex.tooEasy(avgEasy), tone: 'neutral' }

  return (
    <Card padding="lg">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.easyHard.title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
          <Bar dataKey="easyPct" stackId="eh" fill={CHART_COLORS.easy} />
          <Bar dataKey="hardPct" stackId="eh" fill={CHART_COLORS.hard} radius={[3, 3, 0, 0]} />
          <ReferenceLine y={80} stroke={CHART_COLORS.referenceTarget} strokeDasharray="4 3" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <ChartExplain text={explain.text} tone={explain.tone} />
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.easyHard.footnote}
      </p>
    </Card>
  )
}
