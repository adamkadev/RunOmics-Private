import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getRecords } from '@/application/usecases/GetRecords'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { GoalsClient } from '@/components/goals/GoalsClient'

export default function GoalsPage() {
  const data = getGoalsPageData()
  const zones = getTrainingZones()
  const records = getRecords()
  const load = getTrainingLoad()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} zones={zones} records={records} currentTsb={load?.tsb ?? null} />
    </div>
  )
}
