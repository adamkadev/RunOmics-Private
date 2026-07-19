import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { GoalsClient } from '@/components/goals/GoalsClient'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

// Keep in sync with DATE_SENSITIVE_REVALIDATE_SECONDS in @/lib/revalidate (see
// that file for why this can't just be imported here).
export const revalidate = 3600

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return (
    <div className="space-y-6">
      <BackButton label={t.goals.back} fallbackHref="/profile" />
      <GoalsClient data={data} />
    </div>
  )
}
