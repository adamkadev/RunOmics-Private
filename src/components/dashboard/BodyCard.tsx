import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { metricDeltaColor, type MetricDeltaPolarity } from '@/lib/colors'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

const TREND_THRESHOLD = 1

type Status = NonNullable<TrainingStatusDayBar['status']>

/** "↑10 in 7 d": the arrow says which way, the window says over how long. */
export function deltaLabel(delta: number, days: number): string {
  const rounded = Math.round(delta)
  const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : ''
  return t.dashboard.bodyCard.deltaIn(`${arrow}${Math.abs(rounded)}`, days)
}

function Metric({
  label,
  value,
  delta,
  days,
  goodWhen,
  note,
}: {
  label: string
  value: string
  delta: number
  days: number
  goodWhen: MetricDeltaPolarity
  /** A word after the delta, in the same muted line: Form's watch status. */
  note?: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.75">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="font-display text-title2 font-bold leading-none tabular-nums text-foreground">
        {value}
      </div>
      {/* The note carries its " · " in front, pulled out by the row's
          negative margin: wrapped onto its own line, its dot is clipped at
          the edge, so neither line ends or starts on a dot. */}
      <div className="overflow-hidden">
        <div
          className="-ml-2 flex flex-wrap text-caption tabular-nums"
          style={{ color: metricDeltaColor(delta, goodWhen, TREND_THRESHOLD) }}
        >
          <span className="whitespace-nowrap">
            <span aria-hidden="true" className="inline-block w-2" />
            {deltaLabel(delta, days)}
          </span>
          {note && (
            <span className="whitespace-nowrap" data-testid="watch-status">
              <span aria-hidden="true" className="inline-block w-2 text-center">·</span>
              {note}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** The status the watch gave the latest rated day, for the hero's head. */
export function latestRatedStatus(days: TrainingStatusDayBar[]): Status | null {
  return [...days].reverse().find((d) => d.status)?.status ?? null
}

/**
 * Form / Fitness / Fatigue, and nothing else (H03, M7): the watch's status
 * word follows Form's delta (v4.3.4), and the 28-day strip and its "13 of 28 days" moved off
 * Today (the history is on Analytics). Every delta has an arrow and a window.
 */
export function BodyCard({ status, watchStatus = null }: { status: TrainingStatus | null; watchStatus?: Status | null }) {
  if (!status) return null

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4.5 py-4" data-testid="body-card">
      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={t.dashboard.trainingLoad.form}
          value={formatDelta(Math.round(status.tsbNow))}
          delta={status.tsbDelta}
          days={STATUS_DELTA_DAYS.form}
          goodWhen="up"
          note={watchStatus ? t.trainingStatus.status[watchStatus] : null}
        />
        <Metric
          label={t.trainingStatus.metrics.fitness}
          value={String(Math.round(status.ctl))}
          delta={status.ctlDeltaShown}
          days={STATUS_DELTA_DAYS.fitness}
          goodWhen="up"
        />
        <Metric
          label={t.dashboard.trainingLoad.fatigue}
          value={String(Math.round(status.atl))}
          delta={status.atlDelta}
          days={STATUS_DELTA_DAYS.fatigue}
          goodWhen="down"
        />
      </div>
    </GlassSurface>
  )
}
