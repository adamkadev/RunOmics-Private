import { getRecords, getTopEfforts, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getPbAlerts } from '@/application/usecases/GetPbAlerts'
import { RacePredictions } from '@/components/records/RacePredictions'
import { RecordsLeaderboard } from '@/components/records/RecordsLeaderboard'
import { PbAlertLine } from '@/components/ui/PbAlertLine'
import { t } from '@/i18n'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the pbs Firestore collection is written.
export const revalidate = 86400

export default async function RecordsPage() {
  const records = await getRecords()
  const topEfforts = getTopEfforts()
  const pbAlerts = await getPbAlerts()
  const mostRecentRecord = getMostRecentRecord(records)

  return (
    <div className="space-y-8 pb-[max(env(safe-area-inset-bottom),80px)]">
      <div className="space-y-2">
        <div>
          <h1 className="text-display text-foreground">{t.pages.records.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.records.subtitle}</p>
        </div>

        <PbAlertLine alerts={pbAlerts} />
      </div>

      <RecordsLeaderboard records={records} topEfforts={topEfforts} mostRecentKey={mostRecentRecord?.key ?? null} />
      <RacePredictions records={records} />
    </div>
  )
}
