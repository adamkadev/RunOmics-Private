import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { CHART_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const FORM_VALUE = 'var(--accent-text)'
const FORM_LINE = 'var(--accent)'
const FITNESS = CHART_COLORS.ctl
const FATIGUE = CHART_COLORS.atl

const SPARK_POINTS = 30
const TREND_THRESHOLD = 1

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
        style={{ stroke: color }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function trendLabel(delta: number): string {
  const s = t.dashboard.trainingLoad
  if (delta > TREND_THRESHOLD) return s.trendUp(Math.round(delta))
  if (delta < -TREND_THRESHOLD) return s.trendDown(Math.round(delta))
  return s.trendSteady
}

function Tile({
  label,
  value,
  valueColor,
  values,
  lineColor,
  delta,
}: {
  label: string
  value: string
  valueColor: string
  values: number[]
  lineColor: string
  delta?: number
}) {
  return (
    <GlassSurface className="p-3">
      <div className="flex items-center justify-between gap-1">
        <div className="text-micro font-bold uppercase tracking-[0.06em] text-subtle">{label}</div>
        {delta !== undefined && (
          <div className="text-micro tabular-nums text-subtle">
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
  const formLabel = `${form >= 0 ? '+' : ''}${form}`
  const formDelta = status.tsbNow - (points.length >= 8 ? (points[points.length - 8]?.tsb ?? status.tsbNow) : status.tsbNow)

  return (
    <div className="grid grid-cols-3 gap-[9px]">
      <Tile
        label={t.dashboard.trainingLoad.form}
        value={formLabel}
        valueColor={FORM_VALUE}
        values={points.map((p) => p.tsb)}
        lineColor={FORM_LINE}
        delta={formDelta}
      />
      <Tile
        label={t.trainingStatus.metrics.fitness}
        value={String(Math.round(status.ctl))}
        valueColor={FITNESS}
        values={points.map((p) => p.ctl)}
        lineColor={FITNESS}
        delta={status.ctlDelta}
      />
      <Tile
        label={t.dashboard.trainingLoad.fatigue}
        value={String(Math.round(status.atl))}
        valueColor={FATIGUE}
        values={points.map((p) => p.atl)}
        lineColor={FATIGUE}
        delta={status.atlDelta}
      />
    </div>
  )
}
