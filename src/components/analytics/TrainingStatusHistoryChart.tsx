'use client'

import { useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type {
  TrainingStatusHistory,
  TrainingStatusHistoryPoint,
} from '@/application/usecases/GetTrainingStatusHistory'
import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'
import { buildSegments, type TrainingStatusSegment } from '@/domain/training/statusHistory'
import { CHART_COLORS, TRAINING_STATUS_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartCardHead, ChartReading, LegendValue } from '@/components/ui/ChartCard'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { ChartRangeChips, ChartWindowPager, useChartWindow } from '@/components/ui/ChartWindowNav'
import { lineInterpolation, pickForRange } from '@/domain/timeWindow'
import { AXIS_TICK_DATE, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

const BAND_COLOR = CHART_COLORS.ctl

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: TrainingStatusHistoryPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const s = t.analytics.charts.trainingStatusHistory

  return (
    <TooltipCard label={point.label}>
      {point.status && (
        <TooltipRow
          color={TRAINING_STATUS_COLORS[point.status]}
          name={s.status}
          value={t.trainingStatus.status[point.status]}
        />
      )}
      {point.chronicLoad !== null && (
        <TooltipRow color={BAND_COLOR} name={s.chronic} value={point.chronicLoad} />
      )}
      {point.acuteLoad !== null && (
        <TooltipRow color={CHART_COLORS.atl} name={s.acute} value={point.acuteLoad} />
      )}
    </TooltipCard>
  )
}

function formatDay(date: string): string {
  return formatDate(date, AXIS_TICK_DATE)
}

function segmentLabel(segment: TrainingStatusSegment): string {
  const s = t.analytics.charts.trainingStatusHistory
  const range =
    segment.from === segment.to
      ? formatDay(segment.from)
      : `${formatDay(segment.from)} → ${formatDay(segment.to)}`
  return `${t.trainingStatus.status[segment.status]} · ${range} · ${segment.days} ${s.daysUnit}`
}

/**
 * The run of daily verdicts, drawn in order. It was an 8px hairline with no
 * axis of any kind, so a band the reader could hover but not read.
 *
 * The dates are the first and last *rated* day on screen, not the window
 * bounds: unrated days are dropped by buildSegments rather than drawn, so the
 * ribbon's ends are its segments' ends and labelling them with the window
 * would overstate what the strip covers. Hovering swaps the bounds for the
 * hovered segment, the pattern already shipping in TrainingStatusDaysBar.
 */
function StatusRibbon({ segments }: { segments: TrainingStatusSegment[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = segments.find((segment) => segment.from === activeKey) ?? null
  const first = segments[0]
  const last = segments[segments.length - 1]

  return (
    <>
      <div className="mt-3 flex h-6 gap-px overflow-hidden rounded-full">
        {segments.map((segment) => (
          <button
            key={`${segment.status}-${segment.from}`}
            type="button"
            className="min-w-[3px] cursor-pointer transition-opacity"
            style={{
              flexGrow: segment.days,
              backgroundColor: TRAINING_STATUS_COLORS[segment.status],
              opacity: active && active.from !== segment.from ? 0.4 : 1,
            }}
            aria-label={segmentLabel(segment)}
            onClick={() => setActiveKey(segment.from)}
            onMouseEnter={() => setActiveKey(segment.from)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(segment.from)}
            onBlur={() => setActiveKey(null)}
          />
        ))}
      </div>
      <div className="mt-1.5 flex min-h-4 justify-between gap-2 text-micro text-subtle">
        {active ? (
          <span className="text-foreground/80">{segmentLabel(active)}</span>
        ) : (
          <>
            <span className="tabular-nums">{first ? formatDay(first.from) : ''}</span>
            <span className="tabular-nums">{last ? formatDay(last.to) : ''}</span>
          </>
        )}
      </div>
    </>
  )
}

/**
 * How the window's rated days split between statuses, longest share first.
 *
 * These counts are the card's content - the reading is computed from them -
 * but they used to render as a run of 11px dots that wrapped mid-list, so the
 * one comparison they support (which status dominates, by how much) had to be
 * done by reading numbers rather than by looking. Same row as ZoneBar:
 * coloured label, track filled to the share, value right-aligned.
 */
function StatusDistribution({
  legend,
  ratedDays,
}: {
  legend: Array<[TrainingStatusType, number]>
  ratedDays: number
}) {
  const s = t.analytics.charts.trainingStatusHistory

  return (
    <div className="mt-4">
      <SectionDivider className="mb-1.5">{s.distribution}</SectionDivider>
      <div className="space-y-1">
        {legend.map(([status, days]) => {
          const share = (days / ratedDays) * 100
          const color = TRAINING_STATUS_COLORS[status]
          return (
            <div key={status} className="flex items-center gap-2.5">
              <span
                className="w-24 shrink-0 truncate text-left text-xs font-medium"
                style={{ color }}
              >
                {t.trainingStatus.status[status]}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${share}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-[4.75rem] shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                {days} {s.daysUnit} · {Math.round(share)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The most recent value the window actually carries for one of the two lines. */
function latestLoad(
  points: TrainingStatusHistoryPoint[],
  key: 'chronicLoad' | 'acuteLoad',
): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i]?.[key]
    if (value !== null && value !== undefined) return value
  }
  return null
}

export function TrainingStatusHistoryChart({ data }: { data: TrainingStatusHistory }) {
  const s = t.analytics.charts.trainingStatusHistory

  const { range, selectRange, bounds, visible, canGoBack, canGoForward, goBack, goForward } =
    useChartWindow(data.points)

  const segments = buildSegments(visible)
  const plotted = pickForRange(visible, range)
  const ratedDays = segments.reduce((sum, segment) => sum + segment.days, 0)

  const daysByStatus = new Map<TrainingStatusType, number>()
  for (const segment of segments) {
    daysByStatus.set(segment.status, (daysByStatus.get(segment.status) ?? 0) + segment.days)
  }
  const legend = Array.from(daysByStatus.entries()).sort(([, a], [, b]) => b - a)

  const [dominantStatus, dominantDays] = legend[0] ?? []
  const latest = data.points[data.points.length - 1]
  const reading =
    dominantStatus && dominantDays && ratedDays
      ? s.reading(
          t.trainingStatus.status[dominantStatus],
          Math.round((dominantDays / ratedDays) * 100),
          latest?.status ? t.trainingStatus.status[latest.status] : null,
        )
      : null

  const chronicNow = latestLoad(visible, 'chronicLoad')
  const acuteNow = latestLoad(visible, 'acuteLoad')

  const step = Math.max(1, Math.floor(plotted.length / 6))
  const ticks = plotted.filter((_, i) => i % step === 0).map((p) => p.date)
  const summary = `${s.title}: ${legend
    .map(
      ([status, days]) =>
        `${t.trainingStatus.status[status]} ${days} ${s.daysUnit} (${Math.round((days / ratedDays) * 100)}%)`,
    )
    .join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={s.title}
        footnote={s.footnote}
        controls={<ChartRangeChips value={range} onChange={selectRange} />}
      />

      {reading && <ChartReading>{reading}</ChartReading>}

      {/* The legend named only the statuses, so the two series actually plotted -
          the chronic and acute load lines - went unidentified. They now carry
          the window's latest value, so the name and the line are unambiguous. */}
      <div className="mb-3 flex flex-wrap gap-x-3.5 gap-y-1">
        <LegendValue label={s.chronic} value={chronicNow} color={CHART_COLORS.ctl} />
        <LegendValue label={s.acute} value={acuteNow} color={CHART_COLORS.atl} />
      </div>

      <ChartWindowPager
        bounds={bounds}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={goBack}
        onForward={goForward}
      />

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>
      ) : (
        <>
          <ChartFigure summary={summary}>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={plotted} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(date: string) => formatDate(date, AXIS_TICK_DATE)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  dataKey={(point: TrainingStatusHistoryPoint) => point.targetBand?.[0] ?? null}
                  stackId="target"
                  stroke="none"
                  fill="none"
                  isAnimationActive={false}
                />
                <Area
                  dataKey={(point: TrainingStatusHistoryPoint) => point.targetBand?.[1] ?? null}
                  stackId="target"
                  stroke="none"
                  fill={BAND_COLOR}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
                <Line
                  type={lineInterpolation(plotted.length)}
                  dataKey="chronicLoad"
                  stroke={BAND_COLOR}
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type={lineInterpolation(plotted.length)}
                  dataKey="acuteLoad"
                  stroke={CHART_COLORS.atl}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFigure>

          {segments.length > 0 && <StatusRibbon segments={segments} />}

          {legend.length > 0 && ratedDays > 0 && (
            <StatusDistribution legend={legend} ratedDays={ratedDays} />
          )}
        </>
      )}
    </GlassSurface>
  )
}
