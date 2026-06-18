import { getRecords } from '@/application/usecases/GetRecords'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { RecordsWall } from '@/components/records/RecordsWall'
import { RacePredictions } from '@/components/records/RacePredictions'
import { t } from '@/i18n'

export const revalidate = 60

export default async function RecordsPage() {
  const [records, load] = await Promise.all([
    getRecords(),
    Promise.resolve(getTrainingLoad()),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.records.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.records.subtitle}</p>
      </div>

      <RecordsWall records={records} currentTsb={load?.tsb ?? null} />
      <RacePredictions records={records} />
    </div>
  )
}
