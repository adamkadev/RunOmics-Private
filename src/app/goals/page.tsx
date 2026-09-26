import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { macrocycleStart, macrocycleWeek } from '@/components/coaching/presentation'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function GoalsPage() {
  const data = await getGoalsPageData()
  const today = appTodayIso()
  // The block the next race closes, as Plan counts it: macrocycle start to race day.
  const plan = getCoachingOverview(today)?.plan ?? null
  const week = plan ? macrocycleWeek(plan, today) : null
  const block = plan && week
    ? { startDate: macrocycleStart(plan), raceDate: plan.targetEvent.date, week: week.done, weeks: week.total }
    : null

  return (
    <div className="space-y-6">
      <BackButton label={t.goals.back} fallbackHref="/profile" />
      <GoalsClient data={data} today={today} block={block} />
    </div>
  )
}
