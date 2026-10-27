import { SettingsClient } from '@/components/settings/SettingsClient'
import { getGarminSeriesStatus, getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getActivities } from '@/application/usecases/GetActivities'
import { getAthleteProfile } from '@/application/usecases/GetAthleteProfile'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'
import { isSitePrivate } from '@/lib/siteAccess'
import { getGoalsRacesSources } from '@/application/usecases/GetGoalsRacesSources'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export const metadata = {
  title: t.pages.settings.title,
}

export default async function SettingsPage() {
  await loadData()
  const lastSyncedAt = getLastSyncedAt()
  const activityCount = getActivities().length
  const { deviceName, lthrBpm, maxHrBpm } = getAthleteProfile()

  return (
    <SettingsClient
      goalsRaces={{ ...getGoalsRacesSources(), today: appTodayIso() }}
      lastSyncedAt={lastSyncedAt}
      activityCount={activityCount}
      device={deviceName ? { name: deviceName } : undefined}
      zones={{ lthrBpm, maxHrBpm }}
      privateSite={isSitePrivate(process.env)}
      garminSeries={getGarminSeriesStatus()}
    />
  )
}
