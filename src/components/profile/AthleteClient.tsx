'use client'

import type { AthletePageView } from './athleteView'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { BackButton } from '@/components/ui/BackButton'
import { AthleteDetails, AthleteKeyNumbers } from './ProfileAthleteStats'
import { ProfileHrZones } from './ProfileHrZones'
import { formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
import { t } from '@/i18n'

interface Props {
  athlete: AthletePageView
  latestVo2max: number | null
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
  paceZones: TrainingZonesData | null
}

export function AthleteClient({ athlete, latestVo2max, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
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

      <AthleteKeyNumbers athlete={athlete} latestVo2max={latestVo2max} />
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
