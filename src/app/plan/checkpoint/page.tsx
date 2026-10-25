import type { Metadata } from 'next'
import { getCycleCheckpoint } from '@/application/usecases/GetCycleCheckpoint'
import { loadData } from '@/application/usecases/LoadData'
import { Checkpoint } from '@/components/checkpoint/Checkpoint'
import { checkpointView } from '@/components/checkpoint/checkpointView'
import { BackButton } from '@/components/ui/BackButton'
import { appTodayIso } from '@/lib/calendarDate'
import { t } from '@/i18n'

export const metadata: Metadata = { title: t.checkpoint.title }

export const revalidate = 3600

export default async function CheckpointPage() {
  await loadData()
  const today = appTodayIso()
  const view = checkpointView(getCycleCheckpoint(today), today)

  return (
    <div className="space-y-4">
      <BackButton label={t.nav.items.plan} fallbackHref="/plan" />
      <Checkpoint view={view} />
    </div>
  )
}
