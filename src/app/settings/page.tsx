import { SettingsClient } from '@/components/settings/SettingsClient'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { t } from '@/i18n'

export const metadata = {
  title: t.pages.settings.title,
}

export default function SettingsPage() {
  const lastSyncedAt = getLastSyncedAt()
  const activityCount = getAllActivities().length

  return <SettingsClient lastSyncedAt={lastSyncedAt} activityCount={activityCount} />
}
