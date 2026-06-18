import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'

export default function GoalsPage() {
  const data = getGoalsPageData()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} />
    </div>
  )
}
