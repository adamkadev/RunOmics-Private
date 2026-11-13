import { getProfileData } from '@/application/usecases/GetProfileData'
import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getWeeklyStreakData } from '@/application/usecases/GetMilestones'
import { getRecords } from '@/application/usecases/GetRecords'
import { getExploredAreas } from '@/application/usecases/GetExploreGains'
import { getHomeRunsSummary } from '@/application/usecases/GetHomeRuns'
import { getCycleCheckpoint } from '@/application/usecases/GetCycleCheckpoint'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { getReprise } from '@/application/usecases/GetReprise'
import { getReturnProgress } from '@/application/usecases/GetReturnProgress'
import { ProgressHub } from '@/components/profile/ProgressHub'
import { checkpointTileView } from '@/components/checkpoint/checkpointView'
import { progressHubView, returnStep } from '@/components/profile/progressHubView'
import { appTodayIso } from '@/lib/calendarDate'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

export default async function ProfilePage() {
  await loadData()
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
    coaching: getCoachingOverview(today),
    repriseSince: getReprise(today)?.since ?? null,
  })

  // Only the summaries reach the page: no home, no tracks. The area run in last leads.
  const [latest] = [...getExploredAreas()].sort((a, b) => b.lastRunDate.localeCompare(a.lastRunDate))
  const explored = latest ? { name: latest.area.name, pct: latest.summary.pct } : null
  const tile = checkpointTileView(getCycleCheckpoint(today), today)
  const homeRuns = getHomeRunsSummary()

  return (
    <ProgressHub
      view={view}
      explored={explored}
      checkpoint={{ line: tile.line, better: tile.summary?.good ?? null, inProgress: tile.inProgress }}
      homeRuns={homeRuns ? { runCount: homeRuns.runCount, lastDate: homeRuns.lastDate, preview: homeRuns.preview } : null}
      comeback={returnStep(getReturnProgress(today))}
    />
  )
}
