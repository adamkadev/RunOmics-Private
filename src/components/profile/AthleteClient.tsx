'use client'

import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { BackButton } from '@/components/ui/BackButton'
import { ProfileAthleteStats } from './ProfileAthleteStats'
import { ProfileHrZones } from './ProfileHrZones'
import { TrainingZones } from '@/components/analytics/TrainingZones'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
  latestVo2max: number | null
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
  /** Pace zones, moved here from Analytics - reference data, next to the HR zones. */
  paceZones: TrainingZonesData | null
}

export function AthleteClient({ athlete, latestVo2max, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.athlete.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.athlete.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.athlete.subtitle}</p>
      </div>

      <ProfileAthleteStats athlete={athlete} latestVo2max={latestVo2max} />
      <ProfileHrZones athlete={athlete} weeklyZoneTime={weeklyZoneTime} recentZoneTime={recentZoneTime} />
      {paceZones && <TrainingZones data={paceZones} />}
    </div>
  )
}
