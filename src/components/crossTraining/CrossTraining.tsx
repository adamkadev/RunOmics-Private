import { Activity, Bike, Dumbbell, Footprints, HeartPulse, PersonStanding, Waves, type LucideIcon } from 'lucide-react'
import type { CrossTrainingEntry, CrossTrainingKind } from '@/domain/activity/crossTraining'
import { formatDistance, formatDurationWords, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const ICONS: Record<CrossTrainingKind, LucideIcon> = {
  strength: Dumbbell,
  cycling: Bike,
  swimming: Waves,
  walking: Footprints,
  cardio: HeartPulse,
  mobility: PersonStanding,
  other: Activity,
}

export function CrossTrainingIcon({ kind, size = 14, className }: { kind: CrossTrainingKind; size?: number; className?: string }) {
  const Icon = ICONS[kind]
  return <Icon size={size} strokeWidth={2} aria-hidden className={cn('shrink-0', className)} />
}

export function crossTrainingDetail(entry: CrossTrainingEntry): string {
  return [
    formatDurationWords(entry.durationSeconds),
    entry.distanceKm ? `${formatDistance(entry.distanceKm)} ${t.units.km}` : null,
    entry.sets ? t.crossTraining.sets(entry.sets) : null,
  ].filter(Boolean).join(' · ')
}

/** A light list: what was done and for how long, never a run's figures. */
export function CrossTrainingList({ entries, withWeekday = false }: { entries: readonly CrossTrainingEntry[]; withWeekday?: boolean }) {
  return (
    <ul className="flex flex-col" data-testid="cross-training-list">
      {entries.map((entry) => (
        <li key={entry.id} className="flex min-h-[32px] items-center gap-2.5 text-[13px]" data-testid="cross-training-row">
          <CrossTrainingIcon kind={entry.kind} size={15} className="text-[var(--zone-1)]" />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {withWeekday && <span className="text-muted-foreground">{formatWeekday(entry.date, true)} · </span>}
            {t.crossTraining.kinds[entry.kind]}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{crossTrainingDetail(entry)}</span>
        </li>
      ))}
    </ul>
  )
}
