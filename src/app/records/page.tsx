import { getRecords, getTopEfforts } from '@/application/usecases/GetRecords'
import { RacePredictions } from '@/components/records/RacePredictions'
import { RecordsLeaderboard } from '@/components/records/RecordsLeaderboard'
import { t } from '@/i18n'

export const revalidate = 60

export default async function RecordsPage() {
  const records = await getRecords()
  const topEfforts = getTopEfforts()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.records.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.records.subtitle}</p>
      </div>

      <RecordsLeaderboard records={records} topEfforts={topEfforts} />
      <RacePredictions records={records} />
    </div>
  )
}
