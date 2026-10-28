'use client'

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDuration, formatKm } from '@/lib/formatters'
import { RUN_CHART_LINE } from '@/lib/colors'
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
  type LaneKey,
} from './chartStackLanes'

type Props = ChartStackInput & {
  /** Where the scrub is, as a share of the distance. */
  onScrub?: (fraction: number | null) => void
}

type LineMode = 'smoothed' | 'raw'
const LINE_MODES = ['smoothed', 'raw'] as const

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`

/** The run chart's own fixed hues, not the accent. */
const LINE_COLOR: Record<Exclude<LaneKey, 'elevation'>, string> = RUN_CHART_LINE

/** 11 px, the app's type floor. */
const AXIS_LABEL = 'text-caption leading-none'

/**
 * Nothing in it moves: the stack draws the scrub cursor and dot over it, so a
 * pointer move never redraws a path.
 */
const LanePlot = memo(function LanePlot({ lane, series, overlay, distanceKm, color }: { lane: Lane; series: (number | null)[]; overlay?: (number | null)[]; distanceKm: number; color: string }) {
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
              borderTop: rect.top > 0.5 ? `1px solid color-mix(in srgb, var(--zone-${band.zone}) 45%, transparent)` : undefined,
            }}
          >
            {/* On a chip above the lines, so the average line can't strike it out. */}
            {rect.labelled && (
              <span
                className={`absolute right-1 top-px z-[1] rounded-sm bg-card px-0.5 font-semibold ${AXIS_LABEL}`}
                style={{ color: `var(--zone-${band.zone}-text)` }}
              >
                Z{band.zone}
              </span>
            )}
          </div>
        )
      })}
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${LANE_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
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
        {overlay && (
          <path
            d={linePath(overlay, y)}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1.3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
            data-testid="gap-line"
          />
        )}
        <path
          d={linePath(series, y)}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={`absolute left-1.5 top-[3px] text-muted-foreground ${AXIS_LABEL}`}>{lane.format(top)}</span>
      <span className={`absolute bottom-[3px] left-1.5 text-muted-foreground ${AXIS_LABEL}`}>{lane.format(bottom)}</span>
    </>
  )
})

const ElevationPlot = memo(function ElevationPlot({ lane }: { lane: Lane }) {
  const y = (v: number) => elevationY(lane, v)
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${ELEVATION_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <path d={areaPath(lane.smoothed, y, ELEVATION_HEIGHT)} fill="var(--line-2)" />
      <path d={linePath(lane.smoothed, y)} fill="none" stroke="var(--subtle)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
})

function Dot({ left, top, color }: { left: string; top: string; color?: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -ml-[4.5px] -mt-[4.5px] h-[9px] w-[9px] rounded-full border-2 border-background"
      style={{ left, top, background: color ?? 'var(--accent)' }}
    />
  )
}

/** Drawn inside each plot: one line down the whole stack would strike through every lane's header. */
function Cursor({ left }: { left: string }) {
  return (
    <span
      aria-hidden
      data-testid="scrub-cursor"
      className="pointer-events-none absolute inset-y-0 w-px bg-foreground opacity-45"
      style={{ left }}
    />
  )
}

export function ChartStack({ onScrub, ...input }: Props) {
  const {
    distanceKm,
    hrSamples,
    avgHr,
    paceSamples,
    avgPaceSecPerKm,
    gapSamples,
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
        gapSamples,
        cadenceSamples,
        avgCadence,
        elevationProfile,
        elevationGain,
        zones,
      }),
    [distanceKm, hrSamples, avgHr, paceSamples, avgPaceSecPerKm, gapSamples, cadenceSamples, avgCadence, elevationProfile, elevationGain, zones],
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

  // A mouse reads where it hovers and lets go when it leaves; a finger's reading
  // stays after it lifts, so a dot never shows without its number.
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
  const header = on ? (
    <>
      {c.scrubAt.lead}
      <b className="font-semibold text-foreground">{c.scrubAt.km(formatKm(fraction * distanceKm, 1))}</b>
      {elapsed != null && c.scrubAt.elapsed(formatDuration(Math.round(elapsed)))}
    </>
  ) : (
    c.scrubHint
  )
  const summary = lanes.map((l) => `${l.label} ${l.summary}`).join('. ')
  const axis = distanceAxis(distanceKm)

  const reading = (series: (number | null)[]) => (on ? (sampleAt(series, fraction, distanceKm)?.value ?? null) : null)

  return (
    <section className="flex flex-col gap-3" data-testid="chart-stack">
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
            className="relative flex cursor-crosshair touch-pan-y select-none flex-col gap-3"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onPointerLeave={handleLeave}
          >
            {plotted.map((lane) => {
              const series = mode === 'smoothed' ? lane.smoothed : lane.values
              const overlay = lane.overlay && (mode === 'smoothed' ? lane.overlay.smoothed : lane.overlay.values)
              const value = reading(series)
              const overlayValue = overlay ? reading(overlay) : null
              return (
                <div key={lane.key} className="flex flex-col gap-1.5" data-testid={`lane-${lane.key}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
                    <span>
                      <b className="font-semibold text-foreground">{lane.label}</b>{' '}
                      <span className="text-muted-foreground">{lane.unit}</span>
                      {overlay && (
                        <span className="ml-2 text-muted-foreground" data-testid="gap-key">
                          <span aria-hidden className="mr-1 inline-block w-3 border-t-[1.5px] border-foreground align-middle opacity-55" />
                          {c.gap}
                        </span>
                      )}
                    </span>
                    <span className="ml-auto text-right">
                      {value !== null && (
                        <>
                          <b className="font-semibold text-foreground">{`${lane.format(value)} ${lane.valueUnit}`}</b>{' '}
                        </>
                      )}
                      {overlayValue !== null && <span className="text-foreground">{`${c.gapReading(lane.format(overlayValue))} · `}</span>}
                      <span className="text-muted-foreground">{lane.summary}</span>
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded-lg bg-card" style={{ height: LANE_HEIGHT }}>
                    <LanePlot lane={lane} series={series} overlay={overlay} distanceKm={distanceKm} color={LINE_COLOR[lane.key as keyof typeof LINE_COLOR]} />
                    {on && <Cursor left={cursorX} />}
                    {value !== null && (
                      <Dot left={cursorX} top={pct(laneY(lane, value), LANE_HEIGHT)} color={LINE_COLOR[lane.key as keyof typeof LINE_COLOR]} />
                    )}
                  </div>
                  {lane.key === 'pace' && lane.bands.length > 0 && zones?.paceEstimated && (
                    <p className="text-[12px] text-muted-foreground text-pretty" data-testid="pace-zones-estimated">{c.paceZonesEstimated}</p>
                  )}
                </div>
              )
            })}

            {elevation && (() => {
              const value = reading(elevation.smoothed)
              return (
                <div className="flex flex-col gap-1" data-testid="lane-elevation">
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
                    {on && <Cursor left={cursorX} />}
                    <span className={`absolute left-1.5 top-0 text-muted-foreground ${AXIS_LABEL}`} data-testid="elevation-top">
                      {elevation.format(elevation.domain[1])}
                    </span>
                    {value !== null && <Dot left={cursorX} top={pct(elevationY(elevation, value), ELEVATION_HEIGHT)} />}
                  </div>
                </div>
              )
            })()}
          </div>
        </ChartFigure>
      </div>

      <div aria-hidden className={`relative h-3.5 text-muted-foreground ${AXIS_LABEL}`} data-testid="km-axis">
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
    </section>
  )
}
