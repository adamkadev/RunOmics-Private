'use client'

import type { AthletePageView } from './athleteView'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { BackButton } from '@/components/ui/BackButton'
import { AthleteDetails, AthleteKeyNumbers } from './ProfileAthleteStats'
import { ProfileHrZones } from './ProfileHrZones'
import { Vo2GradeCard } from './Vo2GradeCard'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
import { t } from '@/i18n'

interface Props {
  athlete: AthletePageView
  vo2Grade: Vo2GradeView | null
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
  paceZones: TrainingZonesData | null
}

export function AthleteClient({ athlete, vo2Grade, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
  const p = t.pages.athlete
  // The sync's age is read from the browser's clock after mount: worked out on
  // the server it is as old as the cached page, and the two differ - React #418.
  const mounted = useMounted()
  const source = mounted && athlete.lastUpdate ? p.syncedAgo(formatRelativeAgo(athlete.lastUpdate)) : p.fromGarmin

  return (
    <div className="space-y-3">
      <div>
        <BackButton label={p.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{p.title}</h1>
        <p className="mt-1 text-footnote text-muted-foreground">{source}</p>
      </div>

      {vo2Grade && <Vo2GradeCard view={vo2Grade} />}
      <AthleteKeyNumbers athlete={athlete} />
      <ProfileHrZones
        athlete={athlete}
        weeklyZoneTime={weeklyZoneTime}
        recentZoneTime={recentZoneTime}
        paceZones={paceZones}
      />
      <AthleteDetails athlete={athlete} />
    </div>
  )
}
