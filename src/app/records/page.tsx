import { getRecords, getTopEfforts } from '@/application/usecases/GetRecords'
import { getPbAlerts } from '@/application/usecases/GetPbAlerts'
import { getRacePredictions } from '@/application/usecases/GetRacePredictions'
import { getMilestones, getNextMilestones } from '@/application/usecases/GetMilestones'
import { getRecurringRoutes } from '@/application/usecases/GetRecurringRoutes'
import { getReturnProgress } from '@/application/usecases/GetReturnProgress'
import { RecordsClient } from '@/components/records/RecordsClient'
import { appTodayIso } from '@/lib/calendarDate'
import { EFFORT_LIST_MAX } from '@/components/records/recordsView'
import { BackButton } from '@/components/ui/BackButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function RecordsPage() {
  await loadData()
  const today = appTodayIso()
  const records = await getRecords()
  const topEfforts = getTopEfforts(undefined, EFFORT_LIST_MAX)
  const pbAlerts = await getPbAlerts()
  const predictions = await getRacePredictions()
  const milestones = await getMilestones(today)
  const nextMilestones = getNextMilestones(today)
  const recurringRoutes = getRecurringRoutes()

  return (
    <div className="space-y-6">
      <PageHeader back={<BackButton label={t.pages.records.back} fallbackHref="/profile" />} title={t.pages.records.title} />

      <RecordsClient
        records={records}
        topEfforts={topEfforts}
        predictions={predictions}
        pbAlerts={pbAlerts}
        milestones={milestones}
        nextMilestones={nextMilestones}
        recurringRoutes={recurringRoutes}
        returnProgress={getReturnProgress(today)}
        today={today}
      />
    </div>
  )
}
