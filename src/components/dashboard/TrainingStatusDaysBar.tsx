import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { TRAINING_STATUS_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

interface Props {
  days: TrainingStatusDayBar[]
}

const EMPTY_SEGMENT = 'var(--track-on-dark)'

interface DayGroup {
  status: TrainingStatusDayBar['status']
  from: string
  to: string
  count: number
}

/** Merges consecutive days sharing the same status into one wider segment. */
function groupConsecutiveDays(days: TrainingStatusDayBar[]): DayGroup[] {
  const groups: DayGroup[] = []

  for (const day of days) {
    const last = groups[groups.length - 1]
    if (last && last.status === day.status) {
      last.count += 1
      last.to = day.date
      continue
    }
    groups.push({ status: day.status, from: day.date, to: day.date, count: 1 })
  }

  return groups
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
}

function groupLabel(group: DayGroup): string {
  const s = t.dashboard.trainingStatusDays
  const status = group.status ? t.trainingStatus.status[group.status] : s.noReading
  const range = group.count === 1 ? formatDate(group.from) : `${formatDate(group.from)} – ${formatDate(group.to)}`
  return `${status} · ${range}`
}

export function TrainingStatusDaysBar({ days }: Props) {
  if (days.length === 0) return null

  const s = t.dashboard.trainingStatusDays
  const latest = days[days.length - 1]
  const oldest = days[0]
  const oldestLabel = oldest ? formatDate(oldest.date) : ''
  const groups = groupConsecutiveDays(days)

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

      <div className="mt-2.5 flex h-4 overflow-hidden rounded-sm">
        {groups.map((group) => (
          <div
            key={group.from}
            className="h-full"
            style={{
              flexGrow: group.count,
              flexBasis: 0,
              background: group.status ? TRAINING_STATUS_COLORS[group.status] : EMPTY_SEGMENT,
            }}
            title={groupLabel(group)}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-micro text-muted-foreground">
        <span>{oldestLabel}</span>
        <span>{s.today}</span>
      </div>
    </GlassSurface>
  )
}
