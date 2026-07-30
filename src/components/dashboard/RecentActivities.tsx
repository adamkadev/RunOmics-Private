import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ActivityListCard } from '@/components/activities/ActivityListCard'
import { t } from '@/i18n'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'

interface Props {
  activities: ActivitySummary[]
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
}

// Same compact rows as the Activities list, under a plain section header -
// the wrapping card added a second border around already-bordered rows.
export function RecentActivities({ activities, qualifiedEffortsByActivityId = {} }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.recentActivities.title}
        </h3>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-xs text-accent-text transition-colors hover:text-accent-text/70"
        >
          {t.common.viewAll} <ArrowRight size={16} />
        </Link>
      </div>

      <div className="space-y-2">
        {activities.map((a) => (
          <ActivityListCard key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} />
        ))}
      </div>
    </div>
  )
}
