'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThresholdHistoryData, ThresholdPoint } from '@/application/usecases/GetThresholdHistory'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, latestOf, trendDots, windowDateAxis, windowTicks } from '@/components/ui/ChartWindowNav'
import { lineInterpolation } from '@/domain/timeWindow'
import { formatClock, formatDate, formatDelta } from '@/lib/formatters'
import { roundAxis } from '@/lib/chartAxis'
import { t } from '@/i18n'

const HR_COLOR = CHART_COLORS.hr
const PACE_COLOR = CHART_COLORS.pace

// Heart rate reads in fives; a clock-formatted pace axis reads in quarter
// minutes, so its ticks land on 4:15 / 4:30 / 4:45 rather than 4:22 / 4:29.
const BPM_STEP = 5
const PACE_STEP = 15

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

// Derived from the window on screen, and rendered above the chart rather than
// under it - see ChartReading.
function thresholdReading(visible: ThresholdPoint[]): string | null {
  const s = t.analytics.charts.threshold
  const gain = windowPaceGain(visible)
  if (gain === null) return null
  const first = visible.find((p) => p.thresholdPaceSecPerKm !== null)
  const since = first ? formatDate(first.date, { precision: 'month' }) : ''
  return Math.abs(gain) < 1 ? s.reading.flat(since) : s.reading.change(formatDelta(-Math.round(gain), `s/${t.units.km}`), since)
}

export function ThresholdChart({ data }: { data: ThresholdHistoryData }) {
  const s = t.analytics.charts.threshold

  // Derived from the window drawn, not the whole series - the same trap the
  // reading fell into before it measured what the chart shows.
  const legend = (visible: ThresholdPoint[]) => {
    const lthrs = visible.map((p) => p.lthrBpm).filter((v): v is number => v !== null)
    const paces = visible.map((p) => p.thresholdPaceSecPerKm).filter((v): v is number => v !== null)
    const latestLthr = lthrs[lthrs.length - 1]
    const latestPace = paces[paces.length - 1]
    const lthrDelta = lthrs.length >= 2 ? latestLthr! - lthrs[0]! : null
    const gain = windowPaceGain(visible)

    return (
      <>
        <LegendDot
          color={HR_COLOR}
          label={[
            s.lthr,
            latestLthr !== undefined ? `${latestLthr} ${t.units.bpm}` : null,
            lthrDelta !== null && Math.abs(lthrDelta) >= 1 ? formatDelta(Math.round(lthrDelta)) : null,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <LegendDot
          color={PACE_COLOR}
          label={[
            s.pace,
            latestPace !== undefined ? `${formatClock(latestPace)} /${t.units.km}` : null,
            gain !== null && Math.abs(gain) >= 1 ? formatDelta(-Math.round(gain), 's') : null,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </>
    )
  }

  return (
    <WindowedChartCard
      title={s.title}
      legend={legend}
      points={data.points}
      sample={false}
      // Garmin revises the threshold every few weeks, so a 4-week window holds
      // two readings. Open on the window that has data rather than drawing a
      // two-point line - the chart is the point of this card.
      initialRange="6m"
      footnote={s.footnote}
      reading={thresholdReading}
      value={(visible) => {
        const hr = latestOf(visible, (p) => p.lthrBpm)
        const pace = latestOf(visible, (p) => p.thresholdPaceSecPerKm)
        const parts = [
          hr !== null ? `${Math.round(hr)} ${t.units.bpm}` : null,
          pace !== null ? `${formatClock(pace)} ${t.units.perKm}` : null,
        ].filter(Boolean)
        return parts.length ? parts.join(' · ') : null
      }}
    >
      {(visible) => {
        const ticks = windowTicks(visible)
        const hrAxis = roundAxis(visible.map((p) => p.lthrBpm), BPM_STEP)
        const paceAxis = roundAxis(visible.map((p) => p.thresholdPaceSecPerKm), PACE_STEP)
        const explain = thresholdReading(visible)
        const summary = explain ? `${s.title}: ${explain}` : s.title

        return (
          <ChartFigure summary={summary}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                <XAxis {...windowDateAxis(ticks)} />
                <YAxis
                  yAxisId="hr"
                  domain={hrAxis?.domain}
                  ticks={hrAxis?.ticks}
                  interval={0}
                  tick={{ fontSize: 11, fill: HR_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  reversed
                  domain={paceAxis?.domain}
                  ticks={paceAxis?.ticks}
                  interval={0}
                  tickFormatter={formatClock}
                  tick={{ fontSize: 11, fill: PACE_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="hr" type={lineInterpolation(visible.length)} dataKey="lthrBpm" stroke={HR_COLOR} strokeWidth={2.5} {...trendDots(HR_COLOR)} connectNulls isAnimationActive={false} />
                <Line yAxisId="pace" type={lineInterpolation(visible.length)} dataKey="thresholdPaceSecPerKm" stroke={PACE_COLOR} strokeWidth={2.5} {...trendDots(PACE_COLOR)} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFigure>
        )
      }}
    </WindowedChartCard>
  )
}
