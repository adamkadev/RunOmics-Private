'use client'

import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import type { GoalYear } from '@/application/usecases/GetGoalsData'
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
  const [goal, setGoal] = useState(data.goal)

  async function saveDisplayName(name: string) {
    setDisplayName(name)
    await setDoc(
      doc(getClientFirestore(), 'athlete', 'profile'),
      { ...data.athlete, displayName: name, lastUpdate: serverTimestamp() }
    )
  }

  async function saveGoal(goalYear: GoalYear) {
    setGoal((prev) => (prev ? { ...prev, goalYear } : prev))
    await setDoc(doc(getClientFirestore(), 'goals', String(goalYear.year)), goalYear)
  }

  const milestonesCount = milestones.filter((m) => m.type !== 'record').length

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ProfileHero hero={data.hero} displayName={displayName} onSaveName={saveDisplayName} />
        <ProfileStatsYtd ytd={data.ytd} />
        <div className="grid grid-cols-2 gap-3">
          <ProfileGoal goal={goal} onSaveGoal={saveGoal} />
          <ProfileRecords records={data.records} milestonesCount={milestonesCount} />
          <ProfileShoes shoes={data.shoes} />
          <ProfileAthleteTile athlete={data.athlete} />
        </div>
      </div>
    </div>
  )
}
