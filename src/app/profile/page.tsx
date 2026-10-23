import { getProfileData } from '@/application/usecases/GetProfileData'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getRecords } from '@/application/usecases/GetRecords'
import { getExploreHome } from '@/application/usecases/GetExploreAreas'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { ProgressHub } from '@/components/profile/ProgressHub'
import { ExploredCard } from '@/components/explore/ExploredCard'
import { progressHubView } from '@/components/profile/progressHubView'
import { appTodayIso } from '@/lib/calendarDate'

export const revalidate = 3600

export default async function ProfilePage() {
  const today = appTodayIso()
  const data = await getProfileData(today)
  const goals = await getGoalsPageData(today)
  const grade = getVo2Grade()

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
    vo2Grade: grade?.status === 'graded' ? { letter: grade.grade, topPercent: grade.topPercent } : null,
    athlete: { lthrBpm: data.athlete.lthrBpm, thresholdPaceSecPerKm: data.athlete.thresholdPaceSecPerKm },
    records: await getRecords(),
    heatmapDays: getHeatmapData(),
    streakWeeks: getWeeklyStreakData(new Date(`${today}T12:00:00`))?.currentWeeks ?? 0,
    shoes: data.shoes,
  })

  // Only the area, the cluster and its runs reach the card: no home, no tracks.
  const explore = getExploreHome()
  const explored = explore ? (
    <ExploredCard area={explore.area} clusterId={explore.clusterId} runs={explore.runs} dataVersion={explore.dataVersion} />
  ) : undefined

  return <ProgressHub view={view} explored={explored} />
}
