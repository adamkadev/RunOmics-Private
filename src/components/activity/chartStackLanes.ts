import { CHART_COLORS } from '@/lib/colors'
import { cleanStream, paddedDomain } from '@/domain/activity/cleanStream'
import { formatClock } from '@/lib/formatters'
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
  color: string
  values: (number | null)[]
  /** The values as the chart plots them, against distance. */
  data: { d: number; v: number | null }[]
  domain: [number, number]
  reversed: boolean
  /** Spoken description of the lane; the readout row carries the numbers on screen. */
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
 */
export function buildLanes(input: ChartStackInput): Lane[] {
  const { distanceKm, hrSamples, avgHr, paceSamples, avgPaceSecPerKm, cadenceSamples, avgCadence, elevationProfile, elevationGain } = input
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
    const step = Math.max(1, values.length - 1)
    const data = values.map((v, j) => ({ d: (j / step) * distanceKm, v }))
    lanes.push({ key, label, color, values, data, domain, reversed, summary, average, format })
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
