import { getConsistencyData } from '@/application/usecases/GetConsistencyData'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { appTodayIso } from '@/lib/calendarDate'
import { Consistency } from '@/components/consistency/Consistency'
import { consistencyView, mondayOf, plusDays, rangesFor } from '@/components/consistency/consistencyView'
import { getReprise } from '@/application/usecases/GetReprise'
import { BackButton } from '@/components/ui/BackButton'
import { loadPlannedDates } from '../_data/loadWeekTarget'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

/** How far ahead the plan is read: to the end of the last week a month's calendar can show. */
const PLAN_DAYS_AHEAD = 42

// Each ?range= window is worked out here; the switch only picks one.
export default async function ConsistencyPage() {
  await loadData()
  const today = appTodayIso()
  const data = getConsistencyData(today)
  const plannedDates = await loadPlannedDates(today, plusDays(mondayOf(today), PLAN_DAYS_AHEAD), getCoachingOverview(today))
  const reprise = getReprise(today)
  const input = { ...data, today, plannedDates, since: reprise?.since ?? null }
  const views = Object.fromEntries(rangesFor(reprise !== null).ranges.map((range) => [range, consistencyView(range, input)]))
  return (
    <div className="flex flex-col gap-3.5">
      <Consistency views={views} today={today} reprise={reprise !== null} back={<BackButton label={t.pages.consistency.back} fallbackHref="/profile" />} />
    </div>
  )
}
