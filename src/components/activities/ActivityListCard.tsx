import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDate, formatDistance, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
}

/** Compact row: type dot, title + type/RPE/date subtitle, distance + pace on the right. */
export function ActivityListCard({ activity: a, qualifiedEfforts = [] }: Props) {
  const { chartColor } = ACTIVITY_TYPE_CONFIG[a.type]
  const title = a.description || t.activity.runTitle(a.dayOfWeek)

  const subtitle = [
    t.activityTypes[a.type],
    a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null,
    formatDate(a.date),
  ].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/activities/${a.id}`}
      className="glass-card flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-transform duration-[120ms] ease-out active:scale-[0.98] [contain-intrinsic-size:auto_64px] [content-visibility:auto]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColor }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="mt-0.5 block truncate text-xs text-subtle">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-display text-subhead font-bold text-foreground">{formatDistance(a.distanceKm)}</span>
        <span className="ml-0.5 text-caption font-semibold text-muted-foreground">{t.units.km}</span>
        {a.paceSecPerKm !== null && (
          <span className="mt-0.5 block text-caption tabular-nums text-subtle">
            {formatPace(a.paceSecPerKm)}
          </span>
        )}
      </span>
    </Link>
  )
}
