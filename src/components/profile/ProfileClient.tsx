'use client'

import type { ProfileData } from '@/application/usecases/GetProfileData'
import { ProfileHero } from './ProfileHero'
import { ProfileStatsYtd } from './ProfileStatsYtd'
import { ProfileRecords } from './ProfileRecords'
import { ProfileShoes } from './ProfileShoes'
import { ProfileAthleteTile } from './ProfileAthleteTile'
import { ProfileGoal } from './ProfileGoal'

interface Props {
  data: ProfileData
}

export function ProfileClient({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ProfileHero hero={data.hero} displayName={data.athlete.displayName} age={data.athlete.age} sex={data.athlete.sex} />
        <ProfileStatsYtd ytd={data.ytd} />
        <div className="grid grid-cols-2 gap-3">
          <ProfileGoal goal={data.goal} />
          <ProfileRecords records={data.records} />
          <ProfileShoes shoes={data.shoes} />
          <ProfileAthleteTile athlete={data.athlete} />
        </div>
      </div>
    </div>
  )
}
