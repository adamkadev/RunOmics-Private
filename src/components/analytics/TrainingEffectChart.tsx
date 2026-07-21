'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { t } from '@/i18n'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload?: { label?: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={payload[0]?.payload?.label}>
      {payload.map((p) => (
        <p key={p.name} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name} {p.value.toFixed(1)}
        </p>
      ))}
    </TooltipCard>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-subtle">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}
    </span>
  )
}

export function TrainingEffectChart({ points }: { points: WeeklyTrendPoint[] }) {
  const hasAer = points.some((p) => p.aer !== null)
  const hasAna = points.some((p) => p.ana !== null)
  if (!hasAer && !hasAna) return null

  const legend = (
    <>
      {hasAer && <LegendDot color={CHART_COLORS.easy} label={t.analytics.charts.trainingEffect.aerobic} />}
      {hasAna && <LegendDot color={CHART_COLORS.hard} label={t.analytics.charts.trainingEffect.anaerobic} />}
    </>
  )

  return (
    <WindowedChartCard
      title={t.analytics.charts.trainingEffect.title}
      legend={legend}
      points={points}
      footnote={t.analytics.charts.trainingEffect.footnote}
    >
      {(visible) => {
        const aerVals = visible.map((d) => d.aer).filter((v): v is number => v !== null)
        const anaVals = visible.map((d) => d.ana).filter((v): v is number => v !== null)
        if (!aerVals.length && !anaVals.length) {
          return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>
        }

        const ticks = windowTicks(visible)
        const summaryParts: string[] = []
        if (aerVals.length) summaryParts.push(`${t.analytics.charts.trainingEffect.aerobic} ${Math.min(...aerVals).toFixed(1)}–${Math.max(...aerVals).toFixed(1)}`)
        if (anaVals.length) summaryParts.push(`${t.analytics.charts.trainingEffect.anaerobic} ${Math.min(...anaVals).toFixed(1)}–${Math.max(...anaVals).toFixed(1)}`)
        const summary = `${t.analytics.charts.trainingEffect.title}: ${summaryParts.join(', ')}`

        const avgAer = aerVals.length ? aerVals.reduce((s, v) => s + v, 0) / aerVals.length : null
        const avgAna = anaVals.length ? anaVals.reduce((s, v) => s + v, 0) / anaVals.length : null
        const r = t.analytics.charts.trainingEffect.reading
        const reading = avgAer !== null && avgAna !== null
          ? (avgAer - avgAna > 0.3 ? r.aerobicLed : avgAna - avgAer > 0.3 ? r.anaerobicLed : r.balanced)
          : null

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(date: string) => (ticks.has(date) ? windowTickDate(date) : '')}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {hasAer && (
                    <Line
                      type="monotone"
                      dataKey="aer"
                      name={t.analytics.charts.trainingEffect.aerobic}
                      stroke={CHART_COLORS.easy}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                  {hasAna && (
                    <Line
                      type="monotone"
                      dataKey="ana"
                      name={t.analytics.charts.trainingEffect.anaerobic}
                      stroke={CHART_COLORS.hard}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartFigure>
            {reading && <ChartExplain text={reading} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
