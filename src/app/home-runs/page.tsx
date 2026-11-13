import { getHomeRuns } from '@/application/usecases/GetHomeRuns'
import { loadData } from '@/application/usecases/LoadData'
import { HomeRunsPlayer } from '@/components/homeRuns/HomeRunsPlayer'
import { BackButton } from '@/components/ui/BackButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { t } from '@/i18n'

export const revalidate = 3600

export const metadata = {
  title: t.homeRuns.title,
}

export default async function HomeRunsPage() {
  await loadData()
  const spots = getHomeRuns()
  return (
    <div className="space-y-3">
      <PageHeader back={<BackButton label={t.homeRuns.back} fallbackHref="/profile" />} title={t.homeRuns.title} />
      {spots.length > 0 ? (
        <HomeRunsPlayer spots={spots} />
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="home-runs-empty">{t.homeRuns.empty}</p>
      )}
    </div>
  )
}
