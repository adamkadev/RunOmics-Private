import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { median } from '@/lib/math'
import type { WeekRow } from './analyticsView'

const known = (values: (number | null | undefined)[]): number[] => values.filter((v): v is number => v !== null && v !== undefined)

export interface Shift {
  now: number
  /** Now minus the start of the window; null with one reading. */
  delta: number | null
}

/** The last weeks against the first, a median each, as the Pace trend reads its paces: one odd week moves neither end. */
export function blockShift(series: (number | null)[]): Shift | null {
  const values = known(series)
  if (!values.length) return null
  const block = Math.max(1, Math.min(4, Math.floor(values.length / 2)))
  const now = median(values.slice(-block))
  return { now, delta: values.length < 2 ? null : now - median(values.slice(0, block)) }
}

// ─── Running form ──────────────────────────────────────────────────────────

export type FormMetric = 'cadence' | 'groundContact' | 'verticalOscillation' | 'verticalRatio' | 'strideLength'

const FORM_FIELD: Record<FormMetric, keyof WeeklyTrendPoint> = {
  cadence: 'cadenceSpm',
  groundContact: 'groundContactMs',
  verticalOscillation: 'verticalOscillationMm',
  verticalRatio: 'verticalRatioPct',
  strideLength: 'strideLengthM',
}

export const FORM_DECIMALS: Record<FormMetric, number> = { cadence: 0, groundContact: 0, verticalOscillation: 1, verticalRatio: 1, strideLength: 2 }

/** A move under this is the week-to-week wobble of the watch's own readings. */
export const FORM_FLAT: Record<FormMetric, number> = { cadence: 1, groundContact: 3, verticalOscillation: 1, verticalRatio: 0.2, strideLength: 0.02 }

export interface FormRow extends Shift {
  metric: FormMetric
  series: (number | null)[]
  /** Past its wobble: the sentence may name it. */
  moved: boolean
}

/** One row per metric the watch measured in the window; a watch without the sensor has none of them. */
export function formRows(weeks: WeeklyTrendPoint[]): FormRow[] {
  return (Object.keys(FORM_FIELD) as FormMetric[]).flatMap((metric) => {
    const series = weeks.map((w) => w[FORM_FIELD[metric]] as number | null)
    const shift = blockShift(series)
    if (!shift) return []
    return [{ metric, series, ...shift, moved: shift.delta !== null && Math.abs(shift.delta) >= FORM_FLAT[metric] }]
  })
}

/** The row that moved most for its own wobble, or none when every one held. */
export function formLead(rows: FormRow[]): FormRow | null {
  const moved = rows.filter((r) => r.moved)
  if (!moved.length) return null
  return moved.reduce((a, b) => (Math.abs(b.delta!) / FORM_FLAT[b.metric] > Math.abs(a.delta!) / FORM_FLAT[a.metric] ? b : a))
}

// ─── Heart rate ────────────────────────────────────────────────────────────

/** Two beats either way is the noise of a week's mix of runs. */
export const HR_FLAT_BPM = 2

export interface HeartRateView {
  easy: (number | null)[]
  hard: (number | null)[]
  felt: (number | null)[]
  easyShift: Shift | null
  hardNow: number | null
  trend: 'down' | 'up' | 'flat'
}

export function heartRateView(rows: WeekRow[]): HeartRateView | null {
  const easy = rows.map((r) => r.point?.easyAvgHr ?? null)
  const hard = rows.map((r) => r.point?.hardAvgHr ?? null)
  if (known([...easy, ...hard]).length < 2) return null
  const easyShift = blockShift(easy)
  const delta = easyShift?.delta ?? 0
  return {
    easy,
    hard,
    felt: rows.map((r) => r.point?.apparentTempC ?? null),
    easyShift,
    hardNow: blockShift(hard)?.now ?? null,
    trend: delta <= -HR_FLAT_BPM ? 'down' : delta >= HR_FLAT_BPM ? 'up' : 'flat',
  }
}
