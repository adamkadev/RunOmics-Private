import Link from 'next/link'
import { ActivityThumbRow } from '@/components/activities/ActivityThumbRow'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'

interface Props {
  activities: ActivitySummary[]
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
}

/** The latest runs as list rows in one card, each with its route (H06, v4.17). */
export function RecentActivities({ activities, qualifiedEffortsByActivityId = {} }: Props) {
  if (activities.length === 0) return null

  return (
    <section className="flex flex-col gap-3.5" data-testid="recent-activities">
      <div className="mt-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold text-foreground">{t.dashboard.recentActivities.title}</h2>
        <Link href="/activities" className="text-footnote font-medium text-accent-text transition-opacity hover:opacity-80 active:opacity-60">
          {t.common.viewAll} →
        </Link>
      </div>

      <div className={cardClass({ padding: 'none', overflow: true, className: 'divide-y divide-border' })}>
        {activities.map((a) => (
          <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} />
        ))}
      </div>
    </section>
  )
}
