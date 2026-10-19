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
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getTrainingPlan } from '@/application/usecases/GetTrainingPlan'
import { planPhaseLine } from '@/components/plan/planPhase'

export const revalidate = 3600

export default async function ProfilePage() {
  const today = appTodayIso()
  const data = await getProfileData(today)
  const goals = await getGoalsPageData(today)

  const view = progressHubView({
    today,
    activities: getAllActivities(),
    ytd: data.ytd,
    prevYear: data.prevYear,
    allTime: data.allTime,
    sinceDate: data.hero.sinceDate,
    goal: data.goal,
    spotlight: goals.nextRace,
    // The same phase and week Plan's subtitle names.
    planPhase: planPhaseLine(getCoachingOverview(today)?.plan ?? null, getTrainingPlan()?.ranges ?? [], today),
    vo2max: { value: getLatestVO2max(), samples: getVo2maxSamples().days },
    athlete: { lthrBpm: data.athlete.lthrBpm, thresholdPaceSecPerKm: data.athlete.thresholdPaceSecPerKm },
    records: await getRecords(),
    heatmapDays: getHeatmapData(),
    streakWeeks: getWeeklyStreakData(new Date(`${today}T12:00:00`))?.currentWeeks ?? 0,
    shoes: data.shoes,
  })

  return <ProgressHub view={view} />
}
