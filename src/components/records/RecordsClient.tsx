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
import { t } from '@/i18n'

type Tab = 'prs' | 'milestones' | 'routes'

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  mostRecentKey: string | null
  predictions: RacePrediction[]
  pbAlerts: PbAlert[]
  milestones: Milestone[]
  recurringRoutes: RecurringRoute[]
}

// Records and Milestones used to be two separate routes - merged here behind
// a segmented control so "personal bests" has one screen, not two.
export function RecordsClient({ records, topEfforts, mostRecentKey, predictions, pbAlerts, milestones, recurringRoutes }: Props) {
  const [tab, setTab] = useState<Tab>('prs')
  const s = t.records.segmented

  return (
    <div className="space-y-4">
      <GlassSurface
        as="div"
        variant="card"
        role="tablist"
        aria-label={s.prs}
        className="flex gap-1 rounded-full p-1"
      >
        {(['prs', 'milestones', 'routes'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-full py-2 text-sm font-semibold transition-colors',
              tab === id ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground'
            )}
          >
            {s[id]}
          </button>
        ))}
      </GlassSurface>

      {tab === 'prs' && (
        <div className="space-y-3">
          <PbAlertLine alerts={pbAlerts} />
          <RecordsLeaderboard
            records={records}
            topEfforts={topEfforts}
            mostRecentKey={mostRecentKey}
            predictions={predictions}
          />
        </div>
      )}

      {tab === 'milestones' && <MilestonesTimeline milestones={milestones} />}

      {tab === 'routes' && <RecurringRoutes routes={recurringRoutes} />}
    </div>
  )
}
