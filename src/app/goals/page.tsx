import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { appTodayIso } from '@/lib/calendarDate'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { macrocycleStart, macrocycleWeek } from '@/components/coaching/presentation'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function GoalsPage() {
  await loadData()
  const today = appTodayIso()
  const data = await getGoalsPageData(today)
  // The block the next race closes, as Plan counts it: macrocycle start to race day.
  const plan = getCoachingOverview(today)?.plan ?? null
  const week = plan ? macrocycleWeek(plan, today) : null
  const block = plan?.targetEvent && week
    ? { startDate: macrocycleStart(plan), raceDate: plan.targetEvent.date, week: week.done, weeks: week.total }
    : null

  return (
    <GoalsClient data={data} today={today} block={block} back={<BackButton label={t.goals.back} fallbackHref="/profile" />} />
  )
}
