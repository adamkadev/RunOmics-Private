import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'

export default function GoalsPage() {
  const data = getGoalsPageData()
  return <GoalsClient data={data} />
}
