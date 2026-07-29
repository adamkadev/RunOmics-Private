'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThresholdHistoryData, ThresholdPoint } from '@/application/usecases/GetThresholdHistory'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, trendDots, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

const HR_COLOR = CHART_COLORS.hr
const PACE_COLOR = CHART_COLORS.pace

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ThresholdPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const s = t.analytics.charts.threshold
  return (
    <TooltipCard label={p.label}>
      {p.lthrBpm !== null && (
        <TooltipRow color={HR_COLOR} name={s.lthr} value={`${p.lthrBpm} ${t.units.bpm}`} />
      )}
      {p.thresholdPaceSecPerKm !== null && (
        <TooltipRow color={PACE_COLOR} name={s.pace} value={`${formatClock(p.thresholdPaceSecPerKm)} /${t.units.km}`} />
      )}
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

export function ThresholdChart({ data }: { data: ThresholdHistoryData }) {
  const s = t.analytics.charts.threshold
  const gain = data.paceGainSec
  const explain =
    gain === null || Math.abs(gain) < 1
      ? s.reading.flat
      : gain > 0
        ? s.reading.faster(Math.round(gain))
        : s.reading.slower(Math.round(-gain))

  const legend = (
    <>
      <LegendDot color={HR_COLOR} label={s.lthr} />
      <LegendDot color={PACE_COLOR} label={s.pace} />
    </>
  )

  return (
    <WindowedChartCard
      title={s.title}
      legend={legend}
      points={data.points}
      // Revisions are weeks apart, so there is never a wall of points to thin -
      // and averaging them into buckets would report thresholds Garmin never set.
      sample={false}
      footnote={s.footnote}
    >
      {(visible) => {
        const ticks = windowTicks(visible)
        const summary = `${s.title}: ${explain}`

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
                    yAxisId="hr"
                    domain={['dataMin - 3', 'dataMax + 3']}
                    tick={{ fontSize: 11, fill: HR_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />
                  <YAxis
                    yAxisId="pace"
                    orientation="right"
                    reversed
                    domain={['dataMin - 8', 'dataMax + 8']}
                    tickFormatter={formatClock}
                    tick={{ fontSize: 11, fill: PACE_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="hr" type="monotone" dataKey="lthrBpm" stroke={HR_COLOR} strokeWidth={2.5} {...trendDots(HR_COLOR)} connectNulls isAnimationActive={false} />
                  <Line yAxisId="pace" type="monotone" dataKey="thresholdPaceSecPerKm" stroke={PACE_COLOR} strokeWidth={2.5} {...trendDots(PACE_COLOR)} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFigure>
            <ChartExplain text={explain} />
          </>
        )
      }}
    </WindowedChartCard>
  )
}
