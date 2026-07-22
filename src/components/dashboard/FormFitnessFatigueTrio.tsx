import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { t } from '@/i18n'

// Fixed hex, independent of the accent picker - Form/Fitness/Fatigue mean the
// same thing (fresh/fit/tired) whichever accent the athlete has chosen, and the
// blue/orange pairing has to stay put for the reading to hold.
const FORM_VALUE = '#4fe6a0'
const FORM_LINE = '#1ed787'
const FITNESS = '#3b82f6'
const FATIGUE = '#f97316'

const SPARK_POINTS = 30

// Normalise the tail of a load series into a 70x20 polyline (y inverted so a
// rising metric climbs). Flat/short series collapse to a mid-line.
function sparkPoints(values: number[]): string {
  const tail = values.slice(-SPARK_POINTS)
  if (tail.length < 2) return '0,10 70,10'
  const min = Math.min(...tail)
  const max = Math.max(...tail)
  const range = max - min || 1
  return tail
    .map((v, i) => {
      const x = (i / (tail.length - 1)) * 70
      const y = 18 - ((v - min) / range) * 16
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  return (
    <svg width="100%" height="20" viewBox="0 0 70 20" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={sparkPoints(values)}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Tile({
  label,
  value,
  valueColor,
  values,
  lineColor,
}: {
  label: string
  value: string
  valueColor: string
  values: number[]
  lineColor: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">{label}</div>
      <div
        className="my-0.5 font-display text-2xl font-bold tracking-[-0.02em] tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <Sparkline values={values} color={lineColor} />
    </div>
  )
}

// The Form / Fitness / Fatigue read at a glance: current value + a sparkline of
// where it has been. Replaces the old three-metric card + the duplicated load
// chart with one glanceable row. Reads already-computed TSB/CTL/ATL - no maths.
export function FormFitnessFatigueTrio({
  status,
  load,
}: {
  status: TrainingStatus | null
  load: TrainingLoadData | null
}) {
  if (!status || !load) return null

  const points = load.points
  const form = Math.round(status.tsbNow)
  const formLabel = `${form >= 0 ? '+' : ''}${form}`

  return (
    <div className="grid grid-cols-3 gap-[9px]">
      <Tile
        label={t.dashboard.trainingLoad.form}
        value={formLabel}
        valueColor={FORM_VALUE}
        values={points.map((p) => p.tsb)}
        lineColor={FORM_LINE}
      />
      <Tile
        label={t.trainingStatus.metrics.fitness}
        value={String(Math.round(status.ctl))}
        valueColor={FITNESS}
        values={points.map((p) => p.ctl)}
        lineColor={FITNESS}
      />
      <Tile
        label={t.dashboard.trainingLoad.fatigue}
        value={String(Math.round(status.atl))}
        valueColor={FATIGUE}
        values={points.map((p) => p.atl)}
        lineColor={FATIGUE}
      />
    </div>
  )
}
