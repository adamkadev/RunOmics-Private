import { getRecords } from '@/application/usecases/GetRecords'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { RecordsWall } from '@/components/records/RecordsWall'
import { RacePredictions } from '@/components/goals/RacePredictions'
import { t } from '@/i18n'

export default function RecordsPage() {
  const records = getRecords()
  const load = getTrainingLoad()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.records.pageTitle}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.records.pageSubtitle}</p>
      </div>

      <RecordsWall records={records} currentTsb={load?.tsb ?? null} />
      <RacePredictions records={records} />
    </div>
  )
}
