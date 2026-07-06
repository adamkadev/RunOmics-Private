import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the goals/pbs/upcomingRaces Firestore collections are written.
export const revalidate = 86400

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return (
    <div className="space-y-6">
      <BackButton label={t.goals.back} fallbackHref="/profile" />
      <GoalsClient data={data} />
    </div>
  )
}
