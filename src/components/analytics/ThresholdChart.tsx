'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThresholdHistoryData, ThresholdPoint } from '@/application/usecases/GetThresholdHistory'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { SparseSeries, sparseRow, type SparseRow } from '@/components/ui/SparseSeries'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, trendDots, windowDateAxis, windowTicks } from '@/components/ui/ChartWindowNav'
import { formatClock, formatDelta } from '@/lib/formatters'
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

// Pace drops as the athlete gets faster, so a positive gain is an improvement.
// Mirrors getThresholdHistory's convention, but over the visible window.
export function windowPaceGain(points: ThresholdPoint[]): number | null {
  const paces = points.map((p) => p.thresholdPaceSecPerKm).filter((v): v is number => v !== null)
  const first = paces[0]
  const last = paces[paces.length - 1]
  return paces.length >= 2 && first !== undefined && last !== undefined ? first - last : null
}

export function ThresholdChart({ data }: { data: ThresholdHistoryData }) {
  const s = t.analytics.charts.threshold

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
      sample={false}
      footnote={s.footnote}
      sparse={(visible) => (
        <SparseSeries
          count={visible.length}
          rows={
            [
              sparseRow(s.lthr, visible.map((p) => p.lthrBpm), (v) => `${Math.round(v)} ${t.units.bpm}`),
              sparseRow(s.pace, visible.map((p) => p.thresholdPaceSecPerKm), (v) => `${formatClock(v)} /${t.units.km}`),
            ].filter((row): row is SparseRow => row !== null)
          }
        />
      )}
    >
      {(visible) => {
        const ticks = windowTicks(visible)
        const gain = windowPaceGain(visible)
        const explain =
          gain === null
            ? null
            : Math.abs(gain) < 1
              ? s.reading.flat
              : s.reading.change(formatDelta(-Math.round(gain), `s/${t.units.km}`))
        const summary = explain ? `${s.title}: ${explain}` : s.title

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <XAxis {...windowDateAxis(ticks)} />
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
            {explain && <ChartExplain text={explain} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
