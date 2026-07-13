'use client'

import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { BackButton } from '@/components/ui/BackButton'
import { ProfileAthleteStats } from './ProfileAthleteStats'
import { ProfileHrZones } from './ProfileHrZones'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
  weeklyZoneTime: ZoneShare[]
}

export function AthleteClient({ athlete: initialAthlete, weeklyZoneTime }: Props) {
  const [athlete, setAthlete] = useState<AthleteProfile>(initialAthlete)

  async function saveAthlete(patch: Partial<AthleteProfile>) {
    const next = { ...athlete, ...patch }
    setAthlete(next)
    await setDoc(doc(getClientFirestore(), 'athlete', 'profile'), { ...next, lastUpdate: serverTimestamp() })
  }

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.athlete.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.athlete.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.athlete.subtitle}</p>
      </div>

      <ProfileAthleteStats athlete={athlete} onSave={saveAthlete} />
      <ProfileHrZones athlete={athlete} onSave={saveAthlete} weeklyZoneTime={weeklyZoneTime} />
    </div>
  )
}
