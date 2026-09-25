import { getProfileData } from '@/application/usecases/GetProfileData'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { ProgressHub } from '@/components/profile/ProgressHub'
import { progressHubRows } from '@/components/profile/progressHub'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export default async function ProfilePage() {
  const data = await getProfileData()
  const today = appTodayIso()
  const nextRace = await getNextRace()

  const rows = progressHubRows({
    latestRecord: getMostRecentRecord(data.records),
    shoes: data.shoes,
    athlete: { lthrBpm: data.athlete.lthrBpm, thresholdPaceSecPerKm: data.athlete.thresholdPaceSecPerKm },
    latestVo2max: getLatestVO2max(),
    goal: data.goal,
    nextRaceDate: nextRace?.date ?? null,
    heatmapDays: getHeatmapData(),
    now: new Date(`${today}T12:00:00`),
  })

  return <ProgressHub rows={rows} ytd={data.ytd} prevYear={data.prevYear} year={Number(today.slice(0, 4))} />
}
