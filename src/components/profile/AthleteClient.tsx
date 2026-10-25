'use client'

import type { AthletePageView } from './athleteView'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { BackButton } from '@/components/ui/BackButton'
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
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
  paceZones: TrainingZonesData | null
  lastSyncedAt?: string | null
}

export function AthleteClient({ athlete, vo2Grade, fitnessAge, weeklyZoneTime, recentZoneTime, paceZones, lastSyncedAt = null }: Props) {
  const p = t.pages.athlete
  // Relative time only after mount: on the server it is as old as the cached
  // page, and the mismatch is React error #418.
  const mounted = useMounted()
  // The sync time, not the profile's lastUpdate, which only moves when a metric changes.
  const synced = lastSyncedAt ?? athlete.lastUpdate
  const source = mounted && synced ? p.syncedAgo(formatRelativeAgo(synced)) : p.fromGarmin

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5">
        <BackButton label={p.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{p.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{source}</p>
      </header>

      {vo2Grade && <Vo2GradeCard view={vo2Grade} />}
      {fitnessAge && <FitnessAgeCard view={fitnessAge} />}
      <AthleteStats athlete={athlete} />
      <ProfileHrZones
        athlete={athlete}
        weeklyZoneTime={weeklyZoneTime}
        recentZoneTime={recentZoneTime}
        paceZones={paceZones}
      />
      <WellnessHistory />
    </div>
  )
}
