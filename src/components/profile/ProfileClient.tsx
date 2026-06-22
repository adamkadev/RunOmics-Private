'use client'

import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { ProfileData } from '@/application/usecases/GetProfileData'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { ProfileHero } from './ProfileHero'

interface Props {
  data: ProfileData
}

export function ProfileClient({ data }: Props) {
  const [athlete, setAthlete] = useState<AthleteProfile>(data.athlete)

  async function saveAthlete(patch: Partial<AthleteProfile>) {
    const next = { ...athlete, ...patch }
    setAthlete(next)
    await setDoc(doc(getClientFirestore(), 'athlete', 'profile'), next)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ProfileHero
          hero={data.hero}
          displayName={athlete.displayName}
          onSaveName={(name) => saveAthlete({ displayName: name })}
        />
      </div>
    </div>
  )
}
