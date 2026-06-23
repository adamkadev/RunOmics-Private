import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'

export const revalidate = 60

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return (
    <div className="space-y-10 pt-[max(env(safe-area-inset-top),12px)] lg:pt-0">
      <GoalsClient data={data} />
    </div>
  )
}
