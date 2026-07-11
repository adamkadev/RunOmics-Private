'use client'

import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import type { Milestone } from '@/application/usecases/GetMilestones'
import { ProfileHero } from './ProfileHero'
import { ProfileStatsYtd } from './ProfileStatsYtd'
import { ProfileRecords } from './ProfileRecords'
import { ProfileShoes } from './ProfileShoes'
import { ProfileAthleteTile } from './ProfileAthleteTile'
import { ProfileGoal } from './ProfileGoal'

interface Props {
  data: ProfileData
  milestones: Milestone[]
}

export function ProfileClient({ data, milestones }: Props) {
  const [displayName, setDisplayName] = useState(data.athlete.displayName)

  async function saveDisplayName(name: string) {
    setDisplayName(name)
    await setDoc(
      doc(getClientFirestore(), 'athlete', 'profile'),
      { ...data.athlete, displayName: name, lastUpdate: serverTimestamp() }
    )
  }

  const milestonesCount = milestones.filter((m) => m.type !== 'record').length

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ProfileHero hero={data.hero} displayName={displayName} onSaveName={saveDisplayName} />
        <ProfileStatsYtd ytd={data.ytd} />
        <div className="grid grid-cols-2 gap-3">
          <ProfileGoal goal={data.goal} />
          <ProfileRecords records={data.records} milestonesCount={milestonesCount} />
          <ProfileShoes shoes={data.shoes} />
          <ProfileAthleteTile athlete={data.athlete} />
        </div>
      </div>
    </div>
  )
}
