'use client'

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { StatReadout } from '@/components/ui/StatReadout'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'
import { kmTicks } from './chartAxis'
import {
  AXIS_ROW_HEIGHT,
  BOTTOM_MARGIN,
  PLOT_HEIGHT,
  RIGHT_MARGIN,
  ROW_HEIGHT,
  TOP_MARGIN,
  Y_AXIS_WIDTH,
  buildLanes,
  elapsedAt,
  laneY,
  sampleAt,
  type ChartStackInput,
  type Lane,
} from './chartStackLanes'

type Props = ChartStackInput

/**
 * One lane's chart, with nothing in it that moves. The scrub cursor used to be
 * a ReferenceLine and a ReferenceDot inside every chart, so each pointer move
 * re-rendered all four charts over every sample; the cursor is an overlay now
 * and these render once per activity.
 */
const LaneChart = memo(function LaneChart({ lane, distanceKm, isLast }: { lane: Lane; distanceKm: number; isLast: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={isLast ? ROW_HEIGHT + AXIS_ROW_HEIGHT : ROW_HEIGHT}>
      <AreaChart data={lane.data} margin={{ top: TOP_MARGIN, right: RIGHT_MARGIN, bottom: BOTTOM_MARGIN, left: 0 }}>
        <defs>
          <linearGradient id={`stack-${lane.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lane.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={lane.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="d"
          type="number"
          domain={[0, distanceKm]}
          ticks={kmTicks(distanceKm)}
          tickFormatter={(v: number) => (v === 0 ? '' : `${v}`)}
          tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
          axisLine={false}
          tickLine={false}
          hide={!isLast}
          height={AXIS_ROW_HEIGHT}
        />
        <YAxis
          domain={lane.domain}
          ticks={lane.domain}
          interval={0}
          reversed={lane.reversed}
          tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
          axisLine={false}
          tickLine={false}
          width={Y_AXIS_WIDTH}
          tickFormatter={lane.format}
        />
        {lane.average !== null && (
          <ReferenceLine y={lane.average} stroke="var(--subtle)" strokeOpacity={0.6} strokeDasharray="3 3" />
        )}
        <Area
          type="monotone"
          dataKey="v"
          stroke={lane.color}
          strokeWidth={1.5}
          fill={`url(#stack-${lane.key})`}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

/** The scrub mark over one lane: the plot-height rule and the sample's dot. */
function LaneCursor({ lane, mark, distanceKm }: { lane: Lane; mark: { km: number; value: number | null }; distanceKm: number }) {
  const share = distanceKm > 0 ? mark.km / distanceKm : 0
  const left = `calc(${Y_AXIS_WIDTH}px + (100% - ${Y_AXIS_WIDTH + RIGHT_MARGIN}px) * ${share})`
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span
        className="absolute w-px -translate-x-1/2 bg-current opacity-35"
        style={{ left, top: TOP_MARGIN, height: PLOT_HEIGHT }}
      />
      {mark.value != null && (
        <span
          className="absolute h-[4.5px] w-[4.5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left, top: laneY(lane, mark.value), background: lane.color, boxShadow: '0 0 0 1.5px var(--background)' }}
        />
      )}
    </div>
  )
}

export function ChartStack({
  distanceKm,
  hrSamples,
  avgHr,
  paceSamples,
  avgPaceSecPerKm,
  cadenceSamples,
  avgCadence,
  elevationProfile,
  elevationGain,
}: Props) {
  const [fraction, setFraction] = useState<number | null>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)
  const c = t.activity.charts

  const lanes = useMemo(
    () =>
      buildLanes({
        distanceKm,
        hrSamples,
        avgHr,
        paceSamples,
        avgPaceSecPerKm,
        cadenceSamples,
        avgCadence,
        elevationProfile,
        elevationGain,
      }),
    [distanceKm, hrSamples, avgHr, paceSamples, avgPaceSecPerKm, cadenceSamples, avgCadence, elevationProfile, elevationGain],
  )

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  if (lanes.length === 0) return null

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const el = rowsRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = rect.left + Y_AXIS_WIDTH
    const right = rect.right - RIGHT_MARGIN
    if (right <= left) return
    pendingRef.current = Math.min(1, Math.max(0, (event.clientX - left) / (right - left)))
    // A pointer can report several moves between two frames; draw only the
    // last one, once per frame.
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        setFraction(pendingRef.current)
      })
    }
  }

  // A tap commits the readout and a drag moves it: one state, two ways in. It
  // is never cleared on release, because a dot with no number beside it is the
  // thing this scrub exists to avoid.
  function handleDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateFromPointer(event)
  }

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRef.current || event.pointerType === 'mouse') updateFromPointer(event)
  }

  function handleUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const cursorKm = fraction != null ? fraction * distanceKm : null
  const elapsed = fraction != null ? elapsedAt(lanes.find((l) => l.key === 'pace'), fraction, distanceKm) : null
  const summary = lanes.map((l) => `${l.label} ${l.summary}`).join('. ')

  return (
    <div className="space-y-3">
      {/* One labelled value per lane, with its unit and swatch, following the
          scrub line - or the run's averages before the first touch. */}
      <StatReadout
        heading={
          cursorKm != null ? (
            <>
              {c.readoutAt} <b className="font-semibold text-foreground">{cursorKm.toFixed(1)} {t.units.km}</b>
              {elapsed != null && <> · {formatDuration(Math.round(elapsed))}</>} · {c.dragToScrub}
            </>
          ) : (
            <>
              {c.runAverage} · {c.dragToScrub}
            </>
          )
        }
        items={lanes.map((l) => {
          const v = fraction != null ? (sampleAt(l.values, fraction, distanceKm)?.value ?? null) : l.average
          return { key: l.key, label: l.label, color: l.color, value: v != null ? l.format(v) : null, unit: l.unit }
        })}
      />

      <GlassSurface variant="card" className="p-4">
        <ChartFigure summary={summary}>
          <div
            ref={rowsRef}
            className="touch-pan-y select-none"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          >
            {lanes.map((lane, i) => {
              const mark = fraction != null ? sampleAt(lane.values, fraction, distanceKm) : null
              return (
                <div key={lane.key} className={i > 0 ? 'mt-2.5' : undefined}>
                  <div className="flex items-baseline justify-between gap-2 pl-1 text-xs">
                    <span className="font-semibold text-foreground">
                      {lane.label} <span className="font-medium text-subtle">· {lane.unit}</span>
                    </span>
                    <span className="text-muted-foreground">{lane.summary}</span>
                  </div>
                  <div className="relative">
                    <LaneChart lane={lane} distanceKm={distanceKm} isLast={i === lanes.length - 1} />
                    {mark && <LaneCursor lane={lane} mark={mark} distanceKm={distanceKm} />}
                  </div>
                </div>
              )
            })}
          </div>
        </ChartFigure>
      </GlassSurface>
    </div>
  )
}
