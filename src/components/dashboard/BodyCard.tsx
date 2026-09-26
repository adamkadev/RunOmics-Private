import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { deltaColor, type DeltaMetric } from '@/lib/deltaTone'
import { formBand } from '@/domain/training/formBand'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

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
  metric,
  current,
  note,
}: {
  label: string
  value: string
  delta: number
  days: number
  /** Which way is better, and how small is no change (lib/deltaTone). */
  metric: DeltaMetric
  current: number
  /** A word after the delta, in the muted line: Form's band. */
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
        <div className="-ml-2 flex flex-wrap text-caption tabular-nums text-muted-foreground">
          {/* Only the delta takes its meaning's colour (v4.7). */}
          <span className="whitespace-nowrap" style={{ color: deltaColor(metric, delta, { value: current }) }} data-testid="metric-delta">
            <span aria-hidden="true" className="inline-block w-2" />
            {deltaLabel(delta, days)}
          </span>
          {note && (
            <span className="whitespace-nowrap" data-testid="form-band">
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
export function BodyCard({ status }: { status: TrainingStatus | null; watchStatus?: Status | null }) {
  if (!status) return null
  const form = Math.round(status.tsbNow)

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4.5 py-4" data-testid="body-card">
      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={t.dashboard.trainingLoad.form}
          value={formatDelta(form)}
          delta={status.tsbDelta}
          days={STATUS_DELTA_DAYS.form}
          metric="form"
          current={form}
          // Form's own band, as Analytics names it (v4.7). "Productive" was
          // Garmin's training status, not a Form band.
          note={t.formBand[formBand(form)]}
        />
        <Metric
          label={t.trainingStatus.metrics.fitness}
          value={String(Math.round(status.ctl))}
          delta={status.ctlDeltaShown}
          days={STATUS_DELTA_DAYS.fitness}
          metric="fitness"
          current={status.ctl}
        />
        <Metric
          label={t.dashboard.trainingLoad.fatigue}
          value={String(Math.round(status.atl))}
          delta={status.atlDelta}
          days={STATUS_DELTA_DAYS.fatigue}
          metric="fatigue"
          current={status.atl}
        />
      </div>
    </GlassSurface>
  )
}
