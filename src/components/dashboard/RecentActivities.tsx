import { Fragment } from 'react'
import Link from 'next/link'
import { ActivityThumbRow, ThumbRowDivider } from '@/components/activities/ActivityThumbRow'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'
import type { ActivitySummary } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'

interface Props {
  activities: ActivitySummary[]
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
}

/** The latest runs as rows in one card, each with its route (H06, M7). */
export function RecentActivities({ activities, qualifiedEffortsByActivityId = {} }: Props) {
  if (activities.length === 0) return null

  return (
    <section className="space-y-3" data-testid="recent-activities">
      <div className="flex items-center justify-between px-1 pt-1">
        <h3 className="font-display text-base font-semibold text-foreground">{t.dashboard.recentActivities.title}</h3>
        <Link href="/activities" className="text-sm text-accent-text transition-opacity active:opacity-60">
          {t.common.viewAll} →
        </Link>
      </div>

      <GlassSurface variant="card" className="overflow-hidden rounded-[20px]">
        {activities.map((a, i) => (
          <Fragment key={a.id}>
            {i > 0 && <ThumbRowDivider size={56} />}
            <ActivityThumbRow activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} size={56} />
          </Fragment>
        ))}
      </GlassSurface>
    </section>
  )
}
