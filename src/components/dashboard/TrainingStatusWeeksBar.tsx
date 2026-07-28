import type { TrainingStatusWeek } from '@/application/usecases/GetTrainingStatusWeeks'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { TRAINING_STATUS_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

interface Props {
  weeks: TrainingStatusWeek[]
}

const EMPTY_SEGMENT = 'var(--track-on-dark)'

function weekLabel(week: TrainingStatusWeek): string {
  const s = t.dashboard.trainingStatusWeeks
  const status = week.status ? t.trainingStatus.status[week.status] : s.noReading
  const from = new Date(week.weekStart + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
  const to = new Date(week.weekEnd + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
  return `${status} · ${from} – ${to}`
}

export function TrainingStatusWeeksBar({ weeks }: Props) {
  if (weeks.length === 0) return null

  const s = t.dashboard.trainingStatusWeeks
  const latest = weeks[weeks.length - 1]
  const oldest = weeks[0]
  const oldestLabel = oldest
    ? new Date(oldest.weekStart + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
    : ''

  return (
    <GlassSurface variant="card" className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">{s.title}</h3>
        {latest?.status && (
          <span className="text-xs font-semibold" style={{ color: TRAINING_STATUS_COLORS[latest.status] }}>
            {t.trainingStatus.status[latest.status]}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        {weeks.map((week) => (
          <div
            key={week.weekStart}
            className="h-2 flex-1 rounded-full"
            style={{ background: week.status ? TRAINING_STATUS_COLORS[week.status] : EMPTY_SEGMENT }}
            title={weekLabel(week)}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-micro text-muted-foreground">
        <span>{oldestLabel}</span>
        <span>{s.thisWeek}</span>
      </div>
    </GlassSurface>
  )
}
