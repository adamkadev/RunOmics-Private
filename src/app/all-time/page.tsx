import { getAllTime } from '@/application/usecases/GetAllTime'
import { AllTime } from '@/components/profile/AllTime'
import { BackButton } from '@/components/ui/BackButton'
import { appTodayIso } from '@/lib/calendarDate'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export const metadata = {
  title: t.allTime.title,
}

export default async function AllTimePage() {
  await loadData()
  const view = getAllTime(appTodayIso())
  const a = t.allTime
  return (
    <div className="space-y-3">
      <div>
        <BackButton label={a.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{a.title}</h1>
        {view.since && (
          <p className="mt-1 text-footnote text-muted-foreground">
            {a.subtitle(formatDate(view.since, { precision: 'month', year: 'always' }), view.months)}
          </p>
        )}
      </div>
      <AllTime view={view} />
    </div>
  )
}
