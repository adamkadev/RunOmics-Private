import Link from 'next/link'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { formBand, type FormBand } from '@/domain/training/formBand'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { GlossaryInfo } from '@/components/ui/GlossaryTerm'
import { TRAINING_METRIC_COLORS, TRAINING_STATUS_COLORS, metricDeltaColor, type MetricDeltaPolarity } from '@/lib/colors'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

const TREND_THRESHOLD = 1
const EMPTY_SEGMENT = 'var(--track)'

const FORM_BAND_COLOR: Record<FormBand, string> = {
  tired: 'var(--form-band-tired)',
  neutral: 'var(--form-band-neutral)',
  fresh: 'var(--form-band-fresh)',
  veryFresh: 'var(--form-band-very-fresh)',
}

type Status = NonNullable<TrainingStatusDayBar['status']>

interface Segment {
  status: TrainingStatusDayBar['status']
  count: number
}

function segments(days: TrainingStatusDayBar[]): Segment[] {
  const out: Segment[] = []
  for (const day of days) {
    const last = out[out.length - 1]
    if (last && last.status === day.status) last.count += 1
    else out.push({ status: day.status, count: 1 })
  }
  return out
}

/** Each status in the window and its day count, most days first. */
export function statusLegend(days: TrainingStatusDayBar[]): { status: Status; days: number }[] {
  const counts = new Map<Status, number>()
  for (const day of days) if (day.status) counts.set(day.status, (counts.get(day.status) ?? 0) + 1)
  return [...counts.entries()]
    .map(([status, count]) => ({ status, days: count }))
    .sort((a, b) => b.days - a.days || a.status.localeCompare(b.status))
}

/** "↑10 in 7 d": the arrow says which way, the window says over how long. */
export function deltaLabel(delta: number, days: number): string {
  const rounded = Math.round(delta)
  const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : ''
  return t.dashboard.bodyCard.deltaIn(`${arrow}${Math.abs(rounded)}`, days)
}

function Metric({
  label,
  value,
  color,
  band,
  delta,
  days,
  goodWhen,
}: {
  label: string
  value: string
  color: string
  band?: FormBand
  delta: number
  days: number
  goodWhen: MetricDeltaPolarity
}) {
  return (
    <div className="min-w-0">
      <div className="text-caption text-subtle">{label}</div>
      <div className="text-body font-bold tabular-nums" style={{ color }}>
        {value}
        {band && (
          <span className="ml-1 text-xs font-medium" style={{ color: FORM_BAND_COLOR[band] }}>
            {t.formBand[band].toLowerCase()}
          </span>
        )}
      </div>
      <div className="text-caption tabular-nums" style={{ color: metricDeltaColor(delta, goodWhen, TREND_THRESHOLD) }}>
        {deltaLabel(delta, days)}
      </div>
    </div>
  )
}

/**
 * Training status and Form / Fitness / Fatigue, in one card. The strip keeps
 * its 28 days but reads without a tap: a legend under it counts the days of
 * each status, and the whole strip is one target that opens the history. The
 * three numbers keep their place on Today; Form is placed on a named band,
 * and every delta has an arrow and a window, where green "+10" and green
 * "−9" used to mean opposite things.
 */
export function BodyCard({ status, days }: { status: TrainingStatus | null; days: TrainingStatusDayBar[] }) {
  if (!status && days.length === 0) return null

  const s = t.dashboard.bodyCard
  // The latest rated day: the window runs to today, which the watch may not
  // have rated yet.
  const latest = [...days].reverse().find((d) => d.status)?.status ?? null
  const legend = statusLegend(days)
  const latestDays = latest ? (legend.find((l) => l.status === latest)?.days ?? 0) : 0

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4.5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-subtle">
          {t.dashboard.trainingStatusDays.titleToday(t.dashboard.trainingStatusDays.title)}
        </p>
        {/* Form, Fitness and Fatigue (TSB / CTL / ATL) had no definition on
            Today; one (i) over the card holds all three. */}
        {status && <GlossaryInfo terms={['form', 'fitness', 'fatigue']} />}
      </div>
      {latest && (
        <div className="mt-0.5 flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-bold" style={{ color: TRAINING_STATUS_COLORS[latest] }}>
            {t.trainingStatus.status[latest]}
          </span>
          <span className="text-footnote text-muted-foreground">{s.daysOfLast(latestDays, days.length)}</span>
        </div>
      )}

      {days.length > 0 && (
        <Link href="/analytics" aria-label={s.openHistory} className="block rounded-lg active:opacity-70">
          <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-[3px]" aria-hidden="true">
            {segments(days).map((segment, i) => (
              <span
                key={i}
                className="block"
                style={{
                  flex: `${segment.count} 1 0`,
                  background: segment.status ? TRAINING_STATUS_COLORS[segment.status] : EMPTY_SEGMENT,
                }}
              />
            ))}
          </div>
        </Link>
      )}

      {status && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
          <Metric
            label={t.dashboard.trainingLoad.form}
            value={formatDelta(Math.round(status.tsbNow))}
            color={TRAINING_METRIC_COLORS.form}
            band={formBand(status.tsbNow)}
            delta={status.tsbDelta}
            days={STATUS_DELTA_DAYS.form}
            goodWhen="up"
          />
          <Metric
            label={t.trainingStatus.metrics.fitness}
            value={String(Math.round(status.ctl))}
            color={TRAINING_METRIC_COLORS.fitness}
            delta={status.ctlDelta}
            days={STATUS_DELTA_DAYS.fitness}
            goodWhen="up"
          />
          <Metric
            label={t.dashboard.trainingLoad.fatigue}
            value={String(Math.round(status.atl))}
            color={TRAINING_METRIC_COLORS.fatigue}
            delta={status.atlDelta}
            days={STATUS_DELTA_DAYS.fatigue}
            goodWhen="down"
          />
        </div>
      )}
    </GlassSurface>
  )
}
