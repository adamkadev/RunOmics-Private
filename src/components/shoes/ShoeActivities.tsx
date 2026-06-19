'use client'

import { useState } from 'react'
import { Footprints } from 'lucide-react'
import { ActivityRow } from '@/components/activities/ActivityRow'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { t } from '@/i18n'
import type { Activity } from '@/domain/activity/types'

const PAGE_SIZE = 5

export function ShoeActivities({ activities }: { activities: Activity[] }) {
  const [page, setPage] = useState(1)

  if (activities.length === 0) {
    return (
      <Card padding="lg" className="flex flex-col items-center gap-2 py-10 text-center">
        <Footprints size={24} className="text-subtle" />
        <p className="text-sm text-subtle">{t.shoes.detail.empty}</p>
      </Card>
    )
  }

  const totalPages = Math.ceil(activities.length / PAGE_SIZE)
  const paginated = activities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <Card padding="none">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.shoes.detail.activitiesTitle}
        </h3>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {paginated.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
      </div>

      <div className="px-3 pb-3">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </Card>
  )
}
