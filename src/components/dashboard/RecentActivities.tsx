import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ActivityRow } from '@/components/activities/ActivityRow'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'
import type { Activity } from '@/domain/activity/types'

interface Props {
  activities: Activity[]
  prLabelsByActivityId?: Record<string, string[]>
}

export function RecentActivities({ activities, prLabelsByActivityId = {} }: Props) {
  return (
    <Card padding="none">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.recentActivities.title}
        </h3>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-xs text-accent-text hover:text-accent-text/70 transition-colors"
        >
          {t.common.viewAll} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {activities.map((a) => (
          <ActivityRow key={a.id} activity={a} prLabels={prLabelsByActivityId[a.id]} />
        ))}
      </div>
    </Card>
  )
}
