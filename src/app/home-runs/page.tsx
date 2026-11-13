import { getHomeRuns } from '@/application/usecases/GetHomeRuns'
import { loadData } from '@/application/usecases/LoadData'
import { HomeRunsPlayer } from '@/components/homeRuns/HomeRunsPlayer'
import { BackButton } from '@/components/ui/BackButton'
import { appTodayIso } from '@/lib/calendarDate'
import { formatDate } from '@/lib/formatters'
import { PageHeader } from '@/components/layout/PageHeader'
import { t } from '@/i18n'

export const revalidate = 3600

export const metadata = {
  title: t.homeRuns.title,
}

export default async function HomeRunsPage() {
  await loadData()
  const spot = getHomeRuns()[0]
  return (
    <div className="space-y-3">
      <PageHeader back={<BackButton label={t.homeRuns.back} fallbackHref="/profile" />} title={t.homeRuns.title}>
        {spot && (
          <p className="text-sm text-muted-foreground" data-testid="home-runs-subtitle">
            {t.homeRuns.subtitle(spot.runs.length, formatDate(spot.firstDate, { precision: 'month', year: 'always' }))}
          </p>
        )}
      </PageHeader>
      {spot ? (
        <HomeRunsPlayer spot={spot} today={appTodayIso()} />
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="home-runs-empty">{t.homeRuns.empty}</p>
      )}
    </div>
  )
}
