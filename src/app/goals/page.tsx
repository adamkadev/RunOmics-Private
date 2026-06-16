import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { GoalsClient } from '@/components/goals/GoalsClient'

export default function GoalsPage() {
  const data = getGoalsPageData()
  const zones = getTrainingZones()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} zones={zones} />
    </div>
  )
}
