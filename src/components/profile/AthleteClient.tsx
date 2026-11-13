'use client'

import type { AthletePageView } from './athleteView'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { BackButton } from '@/components/ui/BackButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { AthleteStats } from './ProfileAthleteStats'
import { ProfileHrZones } from './ProfileHrZones'
import { Vo2GradeCard } from './Vo2GradeCard'
import { WellnessHistory } from '@/components/wellness/WellnessHistory'
import { FitnessAgeCard } from './FitnessAgeCard'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import type { FitnessAgeView } from '@/application/usecases/GetFitnessAge'
import { formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
import { t } from '@/i18n'

interface Props {
  athlete: AthletePageView
  vo2Grade: Vo2GradeView | null
  fitnessAge: FitnessAgeView | null
  paceZones: TrainingZonesData | null
  lastSyncedAt?: string | null
  reprise?: boolean
}

export function AthleteClient({ athlete, vo2Grade, fitnessAge, paceZones, lastSyncedAt = null, reprise = false }: Props) {
  const p = t.pages.athlete
  // Relative time only after mount: on the server it is as old as the cached
  // page, and the mismatch is React error #418.
  const mounted = useMounted()
  // The sync time, not the profile's lastUpdate, which only moves when a metric changes.
  const synced = lastSyncedAt ?? athlete.lastUpdate
  const source = mounted && synced ? p.syncedAgo(formatRelativeAgo(synced)) : p.fromGarmin

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader back={<BackButton label={p.back} fallbackHref="/profile" />} title={p.title} className="mb-1.5">
        <p className="text-sm text-muted-foreground">{source}</p>
      </PageHeader>

      {vo2Grade && <Vo2GradeCard view={vo2Grade} reprise={reprise} />}
      {fitnessAge && <FitnessAgeCard view={fitnessAge} reprise={reprise} />}
      <AthleteStats athlete={athlete} />
      <ProfileHrZones athlete={athlete} paceZones={paceZones} />
      <WellnessHistory />
    </div>
  )
}
