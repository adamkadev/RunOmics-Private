'use client'

import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import type { Milestone, NextMilestone } from '@/application/usecases/GetMilestones'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { RecordsLeaderboard } from './RecordsLeaderboard'
import { RecurringRoutes } from './RecurringRoutes'
import { ReturnProgressView } from './ReturnProgressView'
import { MilestonesTimeline, NextUpCard } from '@/components/milestones/MilestonesTimeline'
import { PbAlertLine } from '@/components/ui/PbAlertLine'
import { useToday } from '@/lib/useToday'
import { useUrlParam } from '@/lib/useUrlParam'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StickyBar } from '@/components/ui/StickyBar'
import { parseRecordTab, recordTabs as tabsFor, type RecordTab } from './recordsView'
import { t } from '@/i18n'

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  predictions: RacePrediction[]
  pbAlerts: PbAlert[]
  milestones: Milestone[]
  nextMilestones: NextMilestone[]
  recurringRoutes: RecurringRoute[]
  returnProgress?: ReturnProgress | null
  today: string
}

export function RecordsClient({ records, topEfforts, predictions, pbAlerts, milestones, nextMilestones, recurringRoutes, returnProgress = null, today: serverToday }: Props) {
  const today = useToday(serverToday)
  const thisYear = Number(today.slice(0, 4))
  // The tab lives in the URL, so /milestones can land on it and a run's page comes back to it.
  const [tabParam, setTabParam] = useUrlParam('tab')
  const tabIds = tabsFor(returnProgress !== null)
  const tab = parseRecordTab(tabParam, tabIds)
  const setTab = (next: RecordTab) => setTabParam(next === 'best' ? null : next)
  const recordTabs = useSegmentedTabs({ ids: tabIds, value: tab, onChange: setTab })
  const s = { ...t.records.segmented, return: t.returnProgress.tab }

  return (
    <div className="flex flex-col gap-5">
      <StickyBar top="var(--sticky-top, var(--sticky-alone, max(var(--safe-top), 8px)))" className="-my-2">
        <SegmentedTabs
          tabs={recordTabs}
          items={tabIds.map((id) => ({ id, label: s[id] }))}
          label={t.pages.records.title}
          size="md"
          fill
        />
      </StickyBar>

      <div {...recordTabs.panelProps}>
        {tab === 'best' && (
          <div className="space-y-3">
            <PbAlertLine alerts={pbAlerts} />
            <RecordsLeaderboard records={records} topEfforts={topEfforts} predictions={predictions} />
          </div>
        )}

        {tab === 'milestones' && (
          <div className="space-y-4">
            <NextUpCard next={nextMilestones} />
            <MilestonesTimeline milestones={milestones} today={today} />
          </div>
        )}

        {tab === 'return' && returnProgress && <ReturnProgressView progress={returnProgress} today={today} />}

        {tab === 'routes' && <RecurringRoutes routes={recurringRoutes} thisYear={thisYear} />}
      </div>
    </div>
  )
}
