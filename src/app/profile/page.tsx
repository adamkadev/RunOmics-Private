import { getProfileData } from '@/application/usecases/GetProfileData'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getRecords } from '@/application/usecases/GetRecords'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { ProgressHub } from '@/components/profile/ProgressHub'
import { progressHubView } from '@/components/profile/progressHubView'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export default async function ProfilePage() {
  const data = await getProfileData()
  const today = appTodayIso()
  const goals = await getGoalsPageData()

  const view = progressHubView({
    today,
    activities: getAllActivities(),
    ytd: data.ytd,
    prevYear: data.prevYear,
    allTime: data.allTime,
    sinceDate: data.hero.sinceDate,
    goal: data.goal,
    spotlight: goals.nextRace,
    vo2max: { value: getLatestVO2max(), samples: getVo2maxSamples().days },
    athlete: { lthrBpm: data.athlete.lthrBpm, thresholdPaceSecPerKm: data.athlete.thresholdPaceSecPerKm },
    records: await getRecords(),
    heatmapDays: getHeatmapData(),
    streakWeeks: getWeeklyStreakData(new Date(`${today}T12:00:00`))?.currentWeeks ?? 0,
    shoes: data.shoes,
  })

  return <ProgressHub view={view} />
}
