import { SettingsClient } from '@/components/settings/SettingsClient'
import { t } from '@/i18n'

export const metadata = {
  title: t.pages.settings.title,
}

export default function SettingsPage() {
  return <SettingsClient />
}
