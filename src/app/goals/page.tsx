import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getRecords } from '@/application/usecases/GetRecords'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { RecordsStrip } from '@/components/goals/RecordsStrip'
import { RacePredictions } from '@/components/goals/RacePredictions'

export default function GoalsPage() {
  const data = getGoalsPageData()
  const records = getRecords()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} />
      <RecordsStrip records={records} />
      <RacePredictions records={records} />
    </div>
  )
}
