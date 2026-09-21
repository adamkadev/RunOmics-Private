import { getRecords, getTopEfforts } from '@/application/usecases/GetRecords'
import { getPbAlerts } from '@/application/usecases/GetPbAlerts'
import { getRacePredictions } from '@/application/usecases/GetRacePredictions'
import { getMilestones } from '@/application/usecases/GetMilestones'
import { getRecurringRoutes } from '@/application/usecases/GetRecurringRoutes'
import { RecordsClient } from '@/components/records/RecordsClient'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function RecordsPage() {
  const records = await getRecords()
  const topEfforts = getTopEfforts()
  const pbAlerts = await getPbAlerts()
  const predictions = await getRacePredictions()
  const milestones = await getMilestones()
  const recurringRoutes = getRecurringRoutes()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackButton label={t.pages.records.back} fallbackHref="/profile" />
        <div>
          <h1 className="text-display text-foreground">{t.pages.records.title}</h1>
        </div>
      </div>

      <RecordsClient
        records={records}
        topEfforts={topEfforts}
        predictions={predictions}
        pbAlerts={pbAlerts}
        milestones={milestones}
        recurringRoutes={recurringRoutes}
      />
    </div>
  )
}
