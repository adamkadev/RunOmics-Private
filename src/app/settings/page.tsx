import { SettingsClient } from '@/components/settings/SettingsClient'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'
import { isSitePrivate } from '@/lib/siteAccess'
import { getSyncedRaces } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getWrittenGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export const metadata = {
  title: t.pages.settings.title,
}

export default async function SettingsPage() {
  await loadData()
  const lastSyncedAt = getLastSyncedAt()
  const activityCount = getAllActivities().length
  const { deviceName, lthrBpm, maxHrBpm } = getAthleteProfile()

  return (
    <SettingsClient
      goalsRaces={{ syncedRaces: getSyncedRaces(), writtenGoals: getWrittenGoalYears(), today: appTodayIso() }}
      lastSyncedAt={lastSyncedAt}
      activityCount={activityCount}
      device={deviceName ? { name: deviceName } : undefined}
      zones={{ lthrBpm, maxHrBpm }}
      privateSite={isSitePrivate(process.env)}
    />
  )
}
