'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { cleanStream, paddedDomain } from '@/domain/activity/cleanStream'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'
import { kmTicks } from './chartAxis'

const ROW_HEIGHT = 74
const AXIS_ROW_HEIGHT = 20
const Y_AXIS_WIDTH = 42
const RIGHT_MARGIN = 8
const TOP_MARGIN = 10
/** The lowest tick is centred on the plot floor, so it needs room below it. */
const BOTTOM_MARGIN = 7

interface Lane {
  key: string
  label: string
  color: string
  values: (number | null)[]
  domain: [number, number]
  reversed: boolean
  /** Spoken description of the lane; the readout row carries the numbers on screen. */
  summary: string
  average: number | null
  format: (v: number) => string
}

interface Props {
  distanceKm: number
  hrSamples: number[] | null
  avgHr: number | null
  paceSamples: number[] | null
  avgPaceSecPerKm: number | null
  cadenceSamples: number[] | null
  avgCadence: number | null
  elevationProfile: number[] | null
  elevationGain: number | null
}

/**
 * The sample a readout refers to. The mark and the number are taken from the
 * same index here so a lane can never draw its dot at one place and report the
 * value from another.
 */
function sampleAt(
  values: (number | null)[],
  fraction: number,
  distanceKm: number,
): { km: number; value: number | null } | null {
  const last = values.length - 1
  if (last < 0) return null
  const i = Math.min(Math.max(Math.round(fraction * last), 0), last)
  return { km: last > 0 ? (i / last) * distanceKm : 0, value: values[i] ?? null }
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
  const c = t.activity.charts

  const lanes: Lane[] = []

  function push(
    key: string,
    label: string,
    color: string,
    values: (number | null)[],
    minSpan: number,
    format: (v: number) => string,
    summary: string,
    reversed = false,
  ) {
    const domain = paddedDomain(values, minSpan)
    if (!domain) return
    const present = values.filter((v): v is number => v !== null)
    const average = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null
    lanes.push({ key, label, color, values, domain, reversed, summary, average, format })
  }

  if (hrSamples) {
    const values = cleanStream(hrSamples, { min: 60, max: 230 })
    const present = values.filter((v): v is number => v !== null)
    push(
      'hr',
      c.heartRate,
      CHART_COLORS.hr,
      values,
      20,
      (v) => `${Math.round(v)}`,
      present.length > 0
        ? `${avgHr ? `${c.avg} ${avgHr} · ` : ''}${c.max} ${Math.max(...present)} ${t.units.bpm}`
        : '',
    )
  }

  if (paceSamples) {
    const values = cleanStream(paceSamples, {
      min: 150,
      max: 900,
      settleKm: 0.1,
      distanceKm,
      spikeFloor: 90,
    })
    const present = values.filter((v): v is number => v !== null)
    push(
      'pace',
      c.pace,
      CHART_COLORS.pace,
      values,
      60,
      (v) => formatClock(Math.round(v)),
      present.length > 0
        ? `${avgPaceSecPerKm ? `${c.avg} ${formatClock(avgPaceSecPerKm)} · ` : ''}${c.best} ${formatClock(
            Math.min(...present),
          )} ${t.trainingZones.perKm}`
        : '',
      true,
    )
  }

  if (cadenceSamples) {
    const values = cleanStream(cadenceSamples, { min: 100, max: 250, spikeFloor: 25 })
    push(
      'cadence',
      c.cadence,
      CHART_COLORS.cadence,
      values,
      20,
      (v) => `${Math.round(v)}`,
      avgCadence ? `${c.avg} ${avgCadence.toFixed(0)} ${t.units.spm}` : '',
    )
  }

  if (elevationProfile) {
    const values = cleanStream(elevationProfile, { spikeFloor: 60 })
    push(
      'elevation',
      c.elevation,
      CHART_COLORS.elevation,
      values,
      20,
      (v) => `${Math.round(v)}`,
      elevationGain != null ? c.elevationGain(elevationGain) : '',
    )
  }

  if (lanes.length === 0) return null

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const el = rowsRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = rect.left + Y_AXIS_WIDTH
    const right = rect.right - RIGHT_MARGIN
    if (right <= left) return
    setFraction(Math.min(1, Math.max(0, (event.clientX - left) / (right - left))))
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
  const summary = lanes.map((l) => `${l.label} ${l.summary}`).join('. ')

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-2 flex h-5 items-center gap-3">
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {cursorKm != null ? (
            <>
              {cursorKm.toFixed(1)} <span className="font-normal text-subtle">{t.units.km}</span>
            </>
          ) : (
            <span className="font-normal text-subtle">{c.avg}</span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {lanes.map((l) => {
            const v = fraction != null ? (sampleAt(l.values, fraction, distanceKm)?.value ?? null) : l.average
            return (
              <span key={l.key} className="text-xs font-semibold tabular-nums" style={{ color: l.color }}>
                {v != null ? l.format(v) : '—'}
              </span>
            )
          })}
        </span>
      </div>

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
            const isLast = i === lanes.length - 1
            const mark = fraction != null ? sampleAt(lane.values, fraction, distanceKm) : null
            const data = lane.values.map((v, j) => ({
              d: (j / (lane.values.length - 1)) * distanceKm,
              v,
            }))

            return (
              <div key={lane.key} className={i > 0 ? 'mt-2' : undefined}>
                <div className="flex items-baseline justify-between gap-2 pl-1">
                  <span className="flex items-baseline gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: lane.color }} />
                    <span className="text-xs font-semibold text-foreground/80">{lane.label}</span>
                  </span>
                  <span className="text-caption text-subtle-2">{lane.summary}</span>
                </div>
                <ResponsiveContainer width="100%" height={isLast ? ROW_HEIGHT + AXIS_ROW_HEIGHT : ROW_HEIGHT}>
                  <AreaChart
                    data={data}
                    margin={{ top: TOP_MARGIN, right: RIGHT_MARGIN, bottom: BOTTOM_MARGIN, left: 0 }}
                  >
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
                      tick={{ fontSize: 9, fill: CHART_COLORS.axisTick }}
                      axisLine={false}
                      tickLine={false}
                      width={Y_AXIS_WIDTH}
                      tickFormatter={lane.format}
                    />
                    {mark && (
                      <ReferenceLine x={mark.km} stroke="currentColor" strokeOpacity={0.35} />
                    )}
                    {mark && mark.value != null && (
                      <ReferenceDot
                        x={mark.km}
                        y={mark.value}
                        r={3}
                        fill={lane.color}
                        stroke="var(--background)"
                        strokeWidth={1.5}
                      />
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
              </div>
            )
          })}
        </div>
      </ChartFigure>

      <p className="mt-1 text-caption text-subtle">{c.scrubHint}</p>
    </GlassSurface>
  )
}
