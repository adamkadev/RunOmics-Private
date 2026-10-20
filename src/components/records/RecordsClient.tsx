'use client'

import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import type { Milestone, NextMilestone } from '@/application/usecases/GetMilestones'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { RecordsLeaderboard } from './RecordsLeaderboard'
import { RecurringRoutes } from './RecurringRoutes'
import { MilestonesTimeline, NextUpCard } from '@/components/milestones/MilestonesTimeline'
import { PbAlertLine } from '@/components/ui/PbAlertLine'
import { useToday } from '@/lib/useToday'
import { useUrlParam } from '@/lib/useUrlParam'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { RECORD_TABS, parseRecordTab, type RecordTab } from './recordsView'
import { t } from '@/i18n'

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  predictions: RacePrediction[]
  pbAlerts: PbAlert[]
  milestones: Milestone[]
  nextMilestones: NextMilestone[]
  recurringRoutes: RecurringRoute[]
  /** The date the page was prerendered on; see useToday. */
  today: string
}

export function RecordsClient({ records, topEfforts, predictions, pbAlerts, milestones, nextMilestones, recurringRoutes, today: serverToday }: Props) {
  const today = useToday(serverToday)
  const thisYear = Number(today.slice(0, 4))
  // The tab lives in the URL (?tab=milestones), so /milestones can land on
  // it and a visit to a run comes back to the tab it left.
  const [tabParam, setTabParam] = useUrlParam('tab')
  const tab = parseRecordTab(tabParam)
  const setTab = (next: RecordTab) => setTabParam(next === 'best' ? null : next)
  const recordTabs = useSegmentedTabs({ ids: RECORD_TABS, value: tab, onChange: setTab })
  const s = t.records.segmented

  return (
    <div className="space-y-3">
      <SegmentedTabs
        tabs={recordTabs}
        items={RECORD_TABS.map((id) => ({ id, label: s[id] }))}
        label={t.pages.records.title}
        size="md"
        fill
      />

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

        {tab === 'routes' && <RecurringRoutes routes={recurringRoutes} thisYear={thisYear} />}
      </div>
    </div>
  )
}
