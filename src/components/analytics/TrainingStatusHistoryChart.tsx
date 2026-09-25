'use client'

import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type {
  TrainingStatusHistory,
  TrainingStatusHistoryPoint,
} from '@/application/usecases/GetTrainingStatusHistory'
import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'
import { trainingStatusDays } from '@/domain/training/statusHistory'
import { DAY_MS } from '@/lib/calendarDate'
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

/**
 * The window's days, one cell each on a time scale, the same days Today's strip
 * counts (trainingStatusDays). It drew one segment per run of rated records,
 * evenly spaced, so Sep 1, 13, 14, 16 and 25 sat at equal gaps. An unrated day
 * is a gap now, and the three ticks are the window's start, middle and end.
 */
function StatusRibbon({ cells, label }: { cells: { date: string; status: TrainingStatusType | null }[]; label: string }) {
  const first = cells[0]
  const middle = cells[Math.floor((cells.length - 1) / 2)]
  const last = cells[cells.length - 1]

  return (
    <div role="img" aria-label={label}>
      <div className="mt-3 flex h-6 gap-px overflow-hidden rounded-[4px]" data-testid="status-ribbon">
        {cells.map((cell) => (
          <span
            key={cell.date}
            className="min-w-0 flex-1"
            data-status={cell.status ?? 'none'}
            style={{ backgroundColor: cell.status ? TRAINING_STATUS_COLORS[cell.status] : 'var(--track)' }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-caption tabular-nums text-subtle">
        <span>{first ? formatDay(first.date) : ''}</span>
        <span>{middle ? formatDay(middle.date) : ''}</span>
        <span>{last ? formatDay(last.date) : ''}</span>
      </div>
    </div>
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

  const plotted = pickForRange(visible, range)
  // One cell per calendar day of the window, the count Today's strip uses.
  const windowDays = Math.max(1, Math.round((new Date(bounds.to + 'T00:00:00').getTime() - new Date(bounds.from + 'T00:00:00').getTime()) / DAY_MS) + 1)
  const cells = trainingStatusDays(visible, bounds.to, windowDays)
  const ratedDays = cells.filter((cell) => cell.status).length

  const daysByStatus = new Map<TrainingStatusType, number>()
  for (const cell of cells) if (cell.status) daysByStatus.set(cell.status, (daysByStatus.get(cell.status) ?? 0) + 1)
  const legend = Array.from(daysByStatus.entries()).sort(([, a], [, b]) => b - a)

  const [dominantStatus, dominantDays] = legend[0] ?? []
  const latestStatus = [...cells].reverse().find((cell) => cell.status)?.status ?? null
  const reading =
    dominantStatus && dominantDays
      ? s.reading(
          t.trainingStatus.status[dominantStatus],
          dominantDays,
          windowDays,
          latestStatus === dominantStatus ? null : latestStatus ? t.trainingStatus.status[latestStatus] : null,
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
        unit={t.analytics.model.garmin}
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

          {ratedDays > 0 && <StatusRibbon cells={cells} label={summary} />}

          {legend.length > 0 && ratedDays > 0 && (
            <StatusDistribution legend={legend} ratedDays={ratedDays} />
          )}
        </>
      )}
    </GlassSurface>
  )
}
