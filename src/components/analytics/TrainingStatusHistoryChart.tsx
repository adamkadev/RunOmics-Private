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
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartRangeChips, ChartWindowPager, useChartWindow } from '@/components/ui/ChartWindowNav'
import { pickForRange } from '@/domain/timeWindow'
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
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
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
 * Proportional ribbon of the status runs across the window. Segments narrower
 * than a few percent still get a sliver of width so a one-day flip into
 * overreaching stays visible instead of collapsing to nothing.
 */
function StatusRibbon({ segments }: { segments: TrainingStatusSegment[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = segments.find((segment) => segment.from === activeKey) ?? null

  return (
    <>
      <div className="mt-3 flex h-2 gap-px overflow-hidden rounded-full">
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
      <p className="mt-1.5 min-h-4 text-micro text-subtle">{active ? segmentLabel(active) : ''}</p>
    </>
  )
}

export function TrainingStatusHistoryChart({ data }: { data: TrainingStatusHistory }) {
  const s = t.analytics.charts.trainingStatusHistory

  const { range, selectRange, bounds, visible, canGoBack, canGoForward, goBack, goForward } =
    useChartWindow(data.points)

  // Ribbon, legend and reading all describe the visible window, not the whole
  // stored history - paging back re-tells that period's story. The ribbon needs
  // every raw day to size its segments correctly; the plot thins to a real day
  // per stride, which keeps the tooltip honest about the date it labels.
  const segments = buildSegments(visible)
  const plotted = pickForRange(visible, range)
  const ratedDays = segments.reduce((sum, segment) => sum + segment.days, 0)

  // Days present in the ribbon, ranked by how much of the window they cover -
  // the legend reads as "what this block of training actually was".
  const daysByStatus = new Map<TrainingStatusType, number>()
  for (const segment of segments) {
    daysByStatus.set(segment.status, (daysByStatus.get(segment.status) ?? 0) + segment.days)
  }
  const legend = Array.from(daysByStatus.entries()).sort(([, a], [, b]) => b - a)

  const [dominantStatus, dominantDays] = legend[0] ?? []
  // The current status stays anchored on the freshest reading while paging back,
  // so an older window is always read against today's verdict.
  const latest = data.points[data.points.length - 1]
  const reading =
    dominantStatus && dominantDays && ratedDays
      ? s.reading(
          t.trainingStatus.status[dominantStatus],
          Math.round((dominantDays / ratedDays) * 100),
          latest?.status ? t.trainingStatus.status[latest.status] : null,
        )
      : null

  const step = Math.max(1, Math.floor(plotted.length / 6))
  const ticks = plotted.filter((_, i) => i % step === 0).map((p) => p.date)
  const summary = `${s.title}: ${legend
    .map(([status, days]) => `${t.trainingStatus.status[status]} ${days} ${s.daysUnit}`)
    .join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <ChartRangeChips value={range} onChange={selectRange} />
      </div>

      {legend.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
          {legend.map(([status, days]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-subtle">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TRAINING_STATUS_COLORS[status] }}
              />
              {t.trainingStatus.status[status]} · {days}
            </span>
          ))}
        </div>
      )}

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
                  tickFormatter={(date: string) =>
                    new Date(date + 'T00:00:00').toLocaleDateString(t.locale, {
                      day: 'numeric',
                      month: 'short',
                    })
                  }
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Stacked pair: an invisible riser to the band floor, then the band itself. */}
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
                  type="monotone"
                  dataKey="chronicLoad"
                  stroke={BAND_COLOR}
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
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
        </>
      )}

      {reading && <ChartExplain text={reading} />}
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
