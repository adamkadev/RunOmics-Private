import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { TRAINING_METRIC_COLORS, metricDeltaColor, type MetricDeltaPolarity } from '@/lib/colors'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

const FORM = TRAINING_METRIC_COLORS.form
const FITNESS = TRAINING_METRIC_COLORS.fitness
const FATIGUE = TRAINING_METRIC_COLORS.fatigue

const SPARK_POINTS = 30
const TREND_THRESHOLD = 1
const SPARK_W = 70
const SPARK_H = 20
// The end marker and the polyline's round caps both straddle their point, so the
// first and last sample need room inside the viewBox or they get sliced in half.
const SPARK_PAD = 2

interface SparkGeometry {
  points: string
  baselineY: number
  last: { x: number; y: number } | null
}

// Each tile normalises to its own min/max, so the amplitude carries no meaning on
// its own. The baseline says where the window started and the dot says where it
// ends, which is the only reading a 70x20 line can honestly support.
function sparkGeometry(values: number[]): SparkGeometry {
  const tail = values.slice(-SPARK_POINTS)
  if (tail.length < 2) return { points: `0,10 ${SPARK_W},10`, baselineY: 10, last: null }

  const min = Math.min(...tail)
  const max = Math.max(...tail)
  const range = max - min || 1
  const span = SPARK_W - SPARK_PAD * 2
  const coords = tail.map((v, i) => ({
    x: SPARK_PAD + (i / (tail.length - 1)) * span,
    y: 18 - ((v - min) / range) * 16,
  }))

  return {
    points: coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    baselineY: coords[0]!.y,
    last: coords[coords.length - 1]!,
  }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const { points, baselineY, last } = sparkGeometry(values)

  return (
    <svg width="100%" height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
      <line
        x1="0"
        x2={SPARK_W}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--subtle)"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && <circle cx={last.x} cy={last.y} r="1.6" style={{ fill: color }} />}
    </svg>
  )
}

// The value stays honest at every size; TREND_THRESHOLD gates the colour, not
// the number, so a delta of 1 reads as +1 in the flat tone rather than as ~0.
function trendLabel(delta: number): string {
  return formatDelta(Math.round(delta))
}

function Tile({
  label,
  value,
  valueColor,
  values,
  lineColor,
  delta,
  deltaGoodWhen,
}: {
  label: string
  value: string
  valueColor: string
  values: number[]
  lineColor: string
  delta?: number
  deltaGoodWhen: MetricDeltaPolarity
}) {
  return (
    <GlassSurface className="p-3">
      <div className="flex items-baseline justify-between gap-1">
        <div className="text-micro font-bold uppercase tracking-[0.06em] text-subtle">{label}</div>
        {delta !== undefined && (
          <div
            className="text-sm font-bold leading-none tabular-nums"
            style={{ color: metricDeltaColor(delta, deltaGoodWhen, TREND_THRESHOLD) }}
          >
            {trendLabel(delta)}
          </div>
        )}
      </div>
      <div
        className="my-0.5 font-display text-2xl font-bold tracking-[-0.02em] tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <Sparkline values={values} color={lineColor} />
    </GlassSurface>
  )
}

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
  const formLabel = formatDelta(form)

  return (
    <div className="grid grid-cols-3 gap-[9px]">
      <Tile
        label={t.dashboard.trainingLoad.form}
        value={formLabel}
        valueColor={FORM}
        values={points.map((p) => p.tsb)}
        lineColor={FORM}
        delta={status.tsbDelta}
        deltaGoodWhen="up"
      />
      <Tile
        label={t.trainingStatus.metrics.fitness}
        value={String(Math.round(status.ctl))}
        valueColor={FITNESS}
        values={points.map((p) => p.ctl)}
        lineColor={FITNESS}
        delta={status.ctlDelta}
        deltaGoodWhen="up"
      />
      <Tile
        label={t.dashboard.trainingLoad.fatigue}
        value={String(Math.round(status.atl))}
        valueColor={FATIGUE}
        values={points.map((p) => p.atl)}
        lineColor={FATIGUE}
        delta={status.atlDelta}
        deltaGoodWhen="down"
      />
    </div>
  )
}
