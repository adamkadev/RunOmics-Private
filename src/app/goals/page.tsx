import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the goals/pbs/upcomingRaces Firestore collections are written.
export const revalidate = 86400

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return (
    <div className="space-y-10">
      <GoalsClient data={data} />
    </div>
  )
}
