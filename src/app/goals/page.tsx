import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'

export const revalidate = 60

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} />
    </div>
  )
}
