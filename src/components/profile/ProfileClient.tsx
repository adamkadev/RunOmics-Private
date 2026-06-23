'use client'

import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { GoalYear } from '@/application/usecases/GetGoalsData'
import { ProfileHero } from './ProfileHero'
import { ProfileStatsYtd } from './ProfileStatsYtd'
import { ProfileRecords } from './ProfileRecords'
import { ProfileShoes } from './ProfileShoes'
import { ProfileHrZones } from './ProfileHrZones'
import { ProfileAthleteStats } from './ProfileAthleteStats'
import { ProfileGoal } from './ProfileGoal'

interface Props {
  data: ProfileData
}

export function ProfileClient({ data }: Props) {
  const [athlete, setAthlete] = useState<AthleteProfile>(data.athlete)
  const [goal, setGoal] = useState(data.goal)

  async function saveAthlete(patch: Partial<AthleteProfile>) {
    const next = { ...athlete, ...patch }
    setAthlete(next)
    await setDoc(doc(getClientFirestore(), 'athlete', 'profile'), { ...next, lastUpdate: serverTimestamp() })
  }

  async function saveGoal(goalYear: GoalYear) {
    setGoal((prev) => (prev ? { ...prev, goalYear } : prev))
    await setDoc(doc(getClientFirestore(), 'goals', String(goalYear.year)), goalYear)
  }

  return (
    <div className="space-y-6 pt-[max(env(safe-area-inset-top),12px)] lg:pt-0">
      <div className="space-y-3">
        <ProfileHero
          hero={data.hero}
          displayName={athlete.displayName}
          onSaveName={(name) => saveAthlete({ displayName: name })}
        />
        <ProfileStatsYtd ytd={data.ytd} />
        <ProfileRecords records={data.records} />
        <ProfileShoes shoes={data.shoes} />
        <ProfileHrZones athlete={athlete} onSave={saveAthlete} />
        <ProfileAthleteStats athlete={athlete} onSave={saveAthlete} />
        <ProfileGoal goal={goal} onSaveGoal={saveGoal} />
      </div>
    </div>
  )
}
