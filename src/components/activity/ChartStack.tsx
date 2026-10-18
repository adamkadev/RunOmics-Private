'use client'

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDuration, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { distanceAxis } from './chartAxis'
import {
  ELEVATION_HEIGHT,
  LANE_HEIGHT,
  VIEW_WIDTH,
  areaPath,
  bandRect,
  buildLanes,
  elapsedAt,
  elevationY,
  kmTicksPath,
  laneY,
  linePath,
  sampleAt,
  type ChartStackInput,
  type Lane,
} from './chartStackLanes'

type Props = ChartStackInput & {
  /** Where the scrub is, as a share of the distance, for a marker to follow. */
  onScrub?: (fraction: number | null) => void
}

type LineMode = 'smoothed' | 'raw'
const LINE_MODES = ['smoothed', 'raw'] as const

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`

/**
 * One lane with nothing in it that moves: its zone bands, the km ticks, the
 * run average and the line. The scrub cursor and dot are drawn over it by the
 * stack, so a pointer move never redraws a path.
 */
const LanePlot = memo(function LanePlot({ lane, series, distanceKm }: { lane: Lane; series: (number | null)[]; distanceKm: number }) {
  const y = (v: number) => laneY(lane, v)
  const [lo, hi] = lane.domain
  const top = lane.reversed ? lo : hi
  const bottom = lane.reversed ? hi : lo
  return (
    <>
      {lane.bands.map((band) => {
        const rect = bandRect(lane, band)
        if (!rect) return null
        return (
          <div
            key={band.zone}
            data-testid={`zone-band-${lane.key}`}
            className="absolute inset-x-0"
            style={{
              top: pct(rect.top, LANE_HEIGHT),
              height: pct(rect.height, LANE_HEIGHT),
              background: `color-mix(in srgb, var(--zone-${band.zone}) 11%, transparent)`,
            }}
          >
            {/* 11 px like every axis label: the app's type floor (v4.17). Over
                the lines, on a chip of the lane's ground: the run average ran
                through "Z3" and struck it out (screen audit, Oct 2026). */}
            {rect.labelled && (
              <span
                className="absolute right-1 top-px z-[1] rounded-sm bg-background px-0.5 text-caption font-semibold leading-none"
                style={{ color: `var(--zone-${band.zone})` }}
              >
                Z{band.zone}
              </span>
            )}
          </div>
        )
      })}
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${LANE_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {/* line-2: the border grey was 1.0:1 on the lane's ground in light (screen audit, Oct 2026). */}
        <path d={kmTicksPath(distanceKm)} stroke="var(--line-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {lane.average !== null && (
          <path
            d={`M0 ${y(lane.average).toFixed(1)} L${VIEW_WIDTH} ${y(lane.average).toFixed(1)}`}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={linePath(series, y)}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute left-1.5 top-[3px] text-caption leading-none text-muted-foreground">{lane.format(top)}</span>
      <span className="absolute bottom-[3px] left-1.5 text-caption leading-none text-muted-foreground">{lane.format(bottom)}</span>
    </>
  )
})

const ElevationPlot = memo(function ElevationPlot({ lane }: { lane: Lane }) {
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${ELEVATION_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <path d={areaPath(lane.smoothed, (v) => elevationY(lane, v), ELEVATION_HEIGHT)} fill="color-mix(in srgb, var(--band) 55%, transparent)" />
    </svg>
  )
})

/** The scrub's mark on one lane: an accent dot on the line, ringed in the card. */
function Dot({ left, top, size }: { left: string; top: string; size: 8 | 10 }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-full border-2 border-card bg-accent',
        size === 10 ? '-ml-[5px] -mt-[5px] h-2.5 w-2.5' : '-ml-1 -mt-1 h-2 w-2',
      )}
      style={{ left, top }}
    />
  )
}

/**
 * Charts (v4.17): heart rate, pace and cadence as 90 pt lanes in text ink over
 * the athlete's zones, elevation as a strip under them, and one scrub across
 * all of it. The reading sits beside each lane's name and the point on the
 * run in the header - the separate readout card is gone. Smoothed is the
 * default line; Raw shows what was recorded.
 */
export function ChartStack({ onScrub, ...input }: Props) {
  const {
    distanceKm,
    hrSamples,
    avgHr,
    paceSamples,
    avgPaceSecPerKm,
    cadenceSamples,
    avgCadence,
    elevationProfile,
    elevationGain,
    zones,
  } = input
  const [fraction, setFraction] = useState<number | null>(null)
  const [mode, setMode] = useState<LineMode>('smoothed')
  const areaRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)
  const onScrubRef = useRef(onScrub)
  const c = t.activity.charts

  useEffect(() => {
    onScrubRef.current = onScrub
  }, [onScrub])

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
        zones,
      }),
    [distanceKm, hrSamples, avgHr, paceSamples, avgPaceSecPerKm, cadenceSamples, avgCadence, elevationProfile, elevationGain, zones],
  )

  // The scrub snaps to the longest stream's samples, so the cursor, every
  // dot and the map's marker stand on the same point of the run.
  const samples = Math.max(0, ...lanes.map((l) => l.values.length))
  const snap = (f: number) => (samples > 1 ? Math.round(f * (samples - 1)) / (samples - 1) : 0)

  useEffect(() => {
    onScrubRef.current?.(fraction)
  }, [fraction])

  // Leaving the tab takes the marker off the map.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      onScrubRef.current?.(null)
    },
    [],
  )

  const lineTabs = useSegmentedTabs<LineMode>({ ids: LINE_MODES, value: mode, onChange: setMode })

  if (lanes.length === 0) return null

  function schedule(next: number | null) {
    pendingRef.current = next
    // A pointer can report several moves between two frames; draw only the
    // last one, once per frame.
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        setFraction(pendingRef.current)
      })
    }
  }

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const el = areaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    schedule(snap(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))))
  }

  // A tap commits the reading and a drag moves it: one state, two ways in. A
  // mouse reads wherever it hovers and lets go when it leaves; a finger's
  // reading stays after it lifts, because a dot with no number beside it is
  // the thing this scrub exists to avoid.
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

  function handleLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && !draggingRef.current) schedule(null)
  }

  const plotted = lanes.filter((l) => l.key !== 'elevation')
  const elevation = lanes.find((l) => l.key === 'elevation')
  const on = fraction !== null
  const cursorX = on ? `${(fraction * 100).toFixed(2)}%` : '0'
  const elapsed = on ? elapsedAt(lanes.find((l) => l.key === 'pace'), fraction, distanceKm) : null
  const header = on
    ? c.scrubAt(formatKm(fraction * distanceKm, 2), elapsed != null ? formatDuration(Math.round(elapsed)) : null)
    : c.scrubHint
  const summary = lanes.map((l) => `${l.label} ${l.summary}`).join('. ')
  const axis = distanceAxis(distanceKm)
  const hasBands = plotted.some((l) => l.bands.length > 0)

  const reading = (series: (number | null)[]) => (on ? (sampleAt(series, fraction, distanceKm)?.value ?? null) : null)

  return (
    <section className={cardClass({ padding: 'none', className: 'flex flex-col gap-3.5 px-5 pb-3.5 pt-4' })} data-testid="chart-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 text-[13px] text-muted-foreground" data-testid="scrub-header">
          {header}
        </span>
        <SegmentedTabs
          tabs={lineTabs}
          label={c.lineLabel}
          items={[
            { id: 'smoothed', label: c.smoothed },
            { id: 'raw', label: c.raw },
          ]}
          tabClassName="h-[26px] px-2.5 text-xs"
        />
      </div>

      <div {...lineTabs.panelProps} className="outline-none">
        <ChartFigure summary={summary}>
          <div
            ref={areaRef}
            data-testid="chart-scrub"
            className="relative flex cursor-crosshair touch-pan-y select-none flex-col gap-3.5"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onPointerLeave={handleLeave}
          >
            {plotted.map((lane) => {
              const series = mode === 'smoothed' ? lane.smoothed : lane.values
              const value = reading(series)
              return (
                <div key={lane.key} className="flex flex-col gap-1.5" data-testid={`lane-${lane.key}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
                    <span>
                      <b className="font-semibold text-foreground">{lane.label}</b>{' '}
                      <span className="text-muted-foreground">{lane.unit}</span>
                    </span>
                    <span className="ml-auto text-right">
                      {value !== null && (
                        <>
                          <b className="font-semibold text-foreground">{`${lane.format(value)} ${lane.valueUnit}`}</b>{' '}
                        </>
                      )}
                      <span className="text-muted-foreground">{lane.summary}</span>
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded-md bg-background" style={{ height: LANE_HEIGHT }}>
                    <LanePlot lane={lane} series={series} distanceKm={distanceKm} />
                    {value !== null && <Dot left={cursorX} top={pct(laneY(lane, value), LANE_HEIGHT)} size={10} />}
                  </div>
                </div>
              )
            })}

            {elevation && (() => {
              const value = reading(elevation.smoothed)
              return (
                <div className="flex flex-col gap-1" data-testid="lane-elevation">
                  {/* Titled like the lanes above it (screen audit, Oct 2026). */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                    <span>
                      <b className="font-semibold text-foreground">{elevation.label}</b> {elevation.unit}
                    </span>
                    <span className="ml-auto text-right">
                      {value !== null && (
                        <>
                          <b className="font-semibold text-foreground">{`${elevation.format(value)} ${elevation.valueUnit}`}</b>{' '}
                        </>
                      )}
                      {elevation.summary}
                    </span>
                  </div>
                  <div className="relative" style={{ height: ELEVATION_HEIGHT }}>
                    <ElevationPlot lane={elevation} />
                    {/* Its scale, as the lanes write theirs. */}
                    <span className="absolute left-1.5 top-0 text-caption leading-none text-muted-foreground" data-testid="elevation-top">
                      {elevation.format(elevation.domain[1])}
                    </span>
                    {value !== null && <Dot left={cursorX} top={pct(elevationY(elevation, value), ELEVATION_HEIGHT)} size={8} />}
                  </div>
                </div>
              )
            })()}

            {on && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-[var(--text-2)] opacity-60"
                style={{ left: cursorX }}
              />
            )}
          </div>
        </ChartFigure>
      </div>

      <div aria-hidden className="relative h-3.5 text-caption leading-none text-muted-foreground">
        {axis.ticks.map((km, i) => (
          <span
            key={km}
            className="absolute whitespace-nowrap"
            style={{
              left: distanceKm > 0 ? `${(km / distanceKm) * 100}%` : '0',
              transform: i === 0 ? undefined : i === axis.ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {axis.format(km)}
          </span>
        ))}
      </div>

      <Legend className="gap-x-4 border-t border-border pt-2.5">
        {hasBands && (
          <LegendItem swatch="square" color="color-mix(in srgb, var(--zone-2) 22%, transparent)">
            {c.legend.zones}
          </LegendItem>
        )}
        <LegendItem swatch="dash" color="var(--muted-foreground)">
          {c.legend.average}
        </LegendItem>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-px shrink-0 bg-[var(--line-2)]" />
          {c.legend.km}
        </span>
      </Legend>
    </section>
  )
}
