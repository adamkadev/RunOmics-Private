import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getRecords } from '@/application/usecases/GetRecords'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { RecordsStrip } from '@/components/goals/RecordsStrip'
import { RacePredictions } from '@/components/goals/RacePredictions'
import { TrainingZones } from '@/components/goals/TrainingZones'

export default function GoalsPage() {
  const data = getGoalsPageData()
  const records = getRecords()
  const zones = getTrainingZones()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} />
      <RecordsStrip records={records} />
      <RacePredictions records={records} />
      {zones && <TrainingZones data={zones} />}
    </div>
  )
}
