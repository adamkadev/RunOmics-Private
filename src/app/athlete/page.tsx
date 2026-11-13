import { getAthleteProfile } from '@/application/usecases/GetAthleteProfile'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { getFitnessAge } from '@/application/usecases/GetFitnessAge'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { appTodayIso } from '@/lib/calendarDate'
import { AthleteClient } from '@/components/profile/AthleteClient'
import { athletePageView } from '@/components/profile/athleteView'
import { loadData } from '@/application/usecases/LoadData'
import { getRecoveryHistory } from '@/application/usecases/GetLoadRecovery'
import { getReprise } from '@/application/usecases/GetReprise'

export const revalidate = 3600

export default async function AthletePage() {
  await loadData()
  const athlete = getAthleteProfile()

  const today = appTodayIso()

  return (
    <AthleteClient
      athlete={athletePageView(athlete, getRecoveryHistory().at(-1)?.restingHr)}
      vo2Grade={getVo2Grade()}
      fitnessAge={getFitnessAge(today)}
      paceZones={await getTrainingZones()}
      lastSyncedAt={getLastSyncedAt()}
      reprise={getReprise(today) !== null}
    />
  )
}
