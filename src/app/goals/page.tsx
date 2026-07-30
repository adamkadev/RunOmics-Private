import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getRaceReadiness } from '@/application/usecases/GetRaceReadiness'
import { getRaceReadinessInsight } from '@/application/usecases/GetRaceReadinessInsight'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { RaceCountdown } from '@/components/goals/RaceCountdown'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function GoalsPage() {
  const data = await getGoalsPageData()
  const readiness = await getRaceReadiness()

  return (
    <div className="space-y-6">
      <BackButton label={t.goals.back} fallbackHref="/profile" />
      <RaceCountdown readiness={readiness} aiTake={await getRaceReadinessInsight(readiness)} />
      <GoalsClient data={data} />
    </div>
  )
}
