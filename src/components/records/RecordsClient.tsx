'use client'

import { useState } from 'react'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import type { Milestone } from '@/application/usecases/GetMilestones'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { RecordsLeaderboard } from './RecordsLeaderboard'
import { RecurringRoutes } from './RecurringRoutes'
import { MilestonesTimeline } from '@/components/milestones/MilestonesTimeline'
import { PbAlertLine } from '@/components/ui/PbAlertLine'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { useToday } from '@/lib/useToday'
import { useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { t } from '@/i18n'

type Tab = 'prs' | 'milestones' | 'routes'

const RECORD_TABS = ['prs', 'milestones', 'routes'] as const

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  predictions: RacePrediction[]
  pbAlerts: PbAlert[]
  milestones: Milestone[]
  recurringRoutes: RecurringRoute[]
  /** The date the page was prerendered on; see useToday. */
  today: string
}

export function RecordsClient({ records, topEfforts, predictions, pbAlerts, milestones, recurringRoutes, today: serverToday }: Props) {
  const thisYear = Number(useToday(serverToday).slice(0, 4))
  const [tab, setTab] = useState<Tab>('prs')
  const recordTabs = useSegmentedTabs({ ids: RECORD_TABS, value: tab, onChange: setTab })
  const s = t.records.segmented

  return (
    <div className="space-y-4">
      <GlassSurface
        as="div"
        variant="card"
        {...recordTabs.listProps}
        aria-label={s.prs}
        className="flex gap-1 rounded-full p-1"
      >
        {RECORD_TABS.map((id) => (
          <button
            key={id}
            {...recordTabs.tabProps(id)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-full py-2 text-sm font-semibold transition-colors',
              tab === id ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground'
            )}
          >
            {s[id]}
          </button>
        ))}
      </GlassSurface>

      <div {...recordTabs.panelProps}>
      {tab === 'prs' && (
        <div className="space-y-3">
          <PbAlertLine alerts={pbAlerts} />
          <RecordsLeaderboard
            records={records}
            topEfforts={topEfforts}
            predictions={predictions}
          />
        </div>
      )}

      {tab === 'milestones' && <MilestonesTimeline milestones={milestones} />}

      {tab === 'routes' && <RecurringRoutes routes={recurringRoutes} thisYear={thisYear} />}
      </div>
    </div>
  )
}
