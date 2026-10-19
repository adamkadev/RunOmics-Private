import { SettingsClient } from '@/components/settings/SettingsClient'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { t } from '@/i18n'

export const metadata = {
  title: t.pages.settings.title,
}

export default function SettingsPage() {
  const lastSyncedAt = getLastSyncedAt()
  const activityCount = getAllActivities().length
  const { deviceName, heightCm, weightKg, lthrBpm, maxHrBpm } = getAthleteProfile()

  return (
    <SettingsClient
      lastSyncedAt={lastSyncedAt}
      activityCount={activityCount}
      device={deviceName ? { name: deviceName } : undefined}
      body={{ heightCm, weightKg }}
      zones={{ lthrBpm, maxHrBpm }}
    />
  )
}
