import { CHART_COLORS } from '@/lib/colors'
import { cleanStream, paddedDomain } from '@/domain/activity/cleanStream'
import { formatClock } from '@/lib/formatters'
import { paceAxis } from '@/lib/chartAxis'
import { t } from '@/i18n'

export const ROW_HEIGHT = 74
export const AXIS_ROW_HEIGHT = 20
export const Y_AXIS_WIDTH = 42
export const RIGHT_MARGIN = 8
export const TOP_MARGIN = 10
/** The lowest tick is centred on the plot floor, so it needs room below it. */
export const BOTTOM_MARGIN = 7
/**
 * Every lane's plot is this tall. Recharts reserves an x axis's height only
 * when the axis is shown, so the last lane is taller by exactly that much.
 */
export const PLOT_HEIGHT = ROW_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN

export interface Lane {
  key: string
  label: string
  /** What the values are counted in, beside the lane's name and in the readout. */
  unit: string
  color: string
  values: (number | null)[]
  /** The values as the chart plots them, against distance. */
  data: { d: number; v: number | null }[]
  domain: [number, number]
  reversed: boolean
  /** The lane's summary - avg, max or best - computed from the plotted samples. */
  summary: string
  average: number | null
  format: (v: number) => string
}

export interface ChartStackInput {
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
 * The stack's lanes, cleaned and scaled. Pure, and costly enough - four
 * stream cleanups over every sample - that the component builds it once per
 * activity rather than on each pointer move.
 *
 * Every summary is computed from the lane's own cleaned samples. HR used to
 * read its average from the activity and pace mixed the activity's average
 * with the samples' best, so a "best" could print slower than the "avg" beside
 * it.
 */
export function buildLanes(input: ChartStackInput): Lane[] {
  const { distanceKm, hrSamples, paceSamples, cadenceSamples, elevationProfile, elevationGain } = input
  const c = t.activity.charts
  const lanes: Lane[] = []

  function push(
    key: string,
    label: string,
    unit: string,
    color: string,
    values: (number | null)[],
    minSpan: number,
    format: (v: number) => string,
    summarize: (stats: { average: number; min: number; max: number }) => string,
    reversed = false,
  ) {
    const domain = paddedDomain(values, minSpan)
    if (!domain) return
    const present = values.filter((v): v is number => v !== null)
    const average = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null
    const summary = average !== null
      ? summarize({ average, min: Math.min(...present), max: Math.max(...present) })
      : ''
    const step = Math.max(1, values.length - 1)
    const data = values.map((v, j) => ({ d: (j / step) * distanceKm, v }))
    lanes.push({ key, label, unit, color, values, data, domain, reversed, summary, average, format })
  }

  if (hrSamples) {
    const values = cleanStream(hrSamples, { min: 60, max: 230 })
    push(
      'hr',
      c.heartRate,
      t.units.bpm,
      CHART_COLORS.hr,
      values,
      20,
      (v) => `${Math.round(v)}`,
      ({ average, max }) => `${c.avg} ${Math.round(average)} · ${c.max} ${Math.round(max)}`,
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
    // Faster is up, on this chart as on every pace axis (lib/chartAxis).
    push(
      'pace',
      c.pace,
      t.units.perKm,
      CHART_COLORS.pace,
      values,
      60,
      (v) => formatClock(Math.round(v)),
      ({ average, min }) => `${c.avg} ${formatClock(Math.round(average))} · ${c.best} ${formatClock(Math.round(min))}`,
      paceAxis().reversed,
    )
  }

  if (cadenceSamples) {
    const values = cleanStream(cadenceSamples, { min: 100, max: 250, spikeFloor: 25 })
    push(
      'cadence',
      c.cadence,
      t.units.spm,
      CHART_COLORS.cadence,
      values,
      20,
      (v) => `${Math.round(v)}`,
      ({ average }) => `${c.avg} ${Math.round(average)}`,
    )
  }

  if (elevationProfile) {
    const values = cleanStream(elevationProfile, { spikeFloor: 60 })
    push(
      'elevation',
      c.elevation,
      t.units.m,
      CHART_COLORS.elevation,
      values,
      20,
      (v) => `${Math.round(v)}`,
      () => (elevationGain != null ? c.elevationGain(elevationGain) : ''),
    )
  }

  return lanes
}

/**
 * The sample a readout refers to. The mark and the number are taken from the
 * same index here so a lane can never draw its dot at one place and report the
 * value from another.
 */
export function sampleAt(
  values: (number | null)[],
  fraction: number,
  distanceKm: number,
): { km: number; value: number | null } | null {
  const last = values.length - 1
  if (last < 0) return null
  const i = Math.min(Math.max(Math.round(fraction * last), 0), last)
  return { km: last > 0 ? (i / last) * distanceKm : 0, value: values[i] ?? null }
}

/**
 * How far down its chart a value sits, in px: the linear scale Recharts draws
 * the lane with, its domain spread over the plot height and flipped for a
 * reversed lane (pace, where faster is higher). The cursor is drawn over the
 * charts rather than inside them, so it needs the same mapping.
 */
export function laneY(lane: Pick<Lane, 'domain' | 'reversed'>, value: number): number {
  const [lo, hi] = lane.domain
  const share = hi > lo ? (value - lo) / (hi - lo) : 0.5
  return TOP_MARGIN + (lane.reversed ? share : 1 - share) * PLOT_HEIGHT
}

/**
 * Time into the run at a point on the stack, from the pace samples: each one
 * covers an equal share of the distance, so the time to reach a sample is the
 * sum of pace x distance before it. A gap in the stream takes the run's
 * average pace. Null without pace samples - a guess from the total duration
 * would assume an even pace the run did not have.
 */
export function elapsedAt(pace: Lane | undefined, fraction: number, distanceKm: number): number | null {
  if (!pace || pace.average === null || pace.values.length < 2) return null
  const last = pace.values.length - 1
  const upTo = Math.min(Math.max(Math.round(fraction * last), 0), last)
  const stepKm = distanceKm / last
  let seconds = 0
  for (let i = 0; i < upTo; i++) seconds += (pace.values[i] ?? pace.average) * stepKm
  return seconds
}
