import { getAllTime } from '@/application/usecases/GetAllTime'
import { AllTime } from '@/components/profile/AllTime'
import { BackButton } from '@/components/ui/BackButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { appTodayIso } from '@/lib/calendarDate'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'
import { getReprise } from '@/application/usecases/GetReprise'

export const revalidate = 3600

export const metadata = {
  title: t.allTime.title,
}

export default async function AllTimePage() {
  await loadData()
  const today = appTodayIso()
  const view = getAllTime(today)
  const a = t.allTime
  return (
    <div className="space-y-3">
      <PageHeader back={<BackButton label={a.back} fallbackHref="/profile" />} title={a.title}>
        {view.since && (
          <p className="text-footnote text-muted-foreground">
            {a.subtitle(formatDate(view.since, { precision: 'month', year: 'always' }), view.months)}
          </p>
        )}
      </PageHeader>
      <AllTime view={view} reprise={getReprise(today) !== null} />
    </div>
  )
}
