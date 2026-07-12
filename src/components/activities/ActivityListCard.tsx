import Link from 'next/link'
import { PrBadge } from './PrBadge'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { formatDate, formatDistance } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  activity: ActivitySummary
  qualifiedEfforts?: QualifiedEffort[]
}

/** Compact row: type dot, title + type/RPE/date subtitle, distance on the right. */
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
      // content-visibility skips layout/paint for offscreen cards, which keeps
      // long infinite-scroll sessions cheap without a virtualization library.
      className="glass-card flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-transform duration-[120ms] ease-out active:scale-[0.98] [contain-intrinsic-size:auto_52px] [content-visibility:auto]"
    >
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: chartColor }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foreground">{title}</span>
          <PrBadge efforts={qualifiedEfforts} />
        </span>
        <span className="mt-0.5 block truncate text-[9.5px] text-subtle">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-display text-[13px] font-bold text-foreground">{formatDistance(a.distanceKm)}</span>
        <span className="ml-0.5 text-[8px] font-semibold text-muted-foreground">{t.units.km}</span>
      </span>
    </Link>
  )
}
