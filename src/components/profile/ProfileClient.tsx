'use client'

import type { ProfileData } from '@/application/usecases/GetProfileData'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { ProfileHero } from './ProfileHero'
import { ProfileStatsYtd } from './ProfileStatsYtd'
import { ProfileRecords } from './ProfileRecords'
import { ProfileShoes } from './ProfileShoes'
import { ProfileGoal } from './ProfileGoal'
import { ProfileAthleteCard } from './ProfileAthleteCard'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { t } from '@/i18n'

interface Props {
  data: ProfileData
  heatmapDays: HeatmapDay[]
  latestVo2max: number | null
  recentZoneTime: ZoneShare[]
}

export function ProfileClient({ data, heatmapDays, latestVo2max, recentZoneTime }: Props) {
  return (
    <div className="space-y-3.5">
      <h1 className="px-1 font-display text-title1 font-bold tracking-tight text-foreground">
        {t.nav.items.profile}
      </h1>
      <ProfileHero hero={data.hero} displayName={data.athlete.displayName} />
      <ProfileStatsYtd ytd={data.ytd} allTime={data.allTime} prevYear={data.prevYear} />
      <ActivityHeatmap days={heatmapDays} />
      <div className="grid grid-cols-2 gap-3">
        <ProfileGoal goal={data.goal} />
        <ProfileRecords records={data.records} />
      </div>
      <ProfileAthleteCard athlete={data.athlete} latestVo2max={latestVo2max} recentZoneTime={recentZoneTime} />
      <ProfileShoes shoes={data.shoes} />
    </div>
  )
}
