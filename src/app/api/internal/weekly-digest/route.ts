import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getActivitySummaries } from '@/application/usecases/GetActivities'
import { getPlannedWorkouts } from '@/application/usecases/GetPlannedWorkouts'
import { getCoachingOverview } from '@/application/coaching/GetCoachingView'
import { getRecoveryHistory } from '@/application/usecases/GetLoadRecovery'
import { getCrossTrainingEntries } from '@/application/usecases/GetCrossTraining'
import { sendOncePer } from '@/application/usecases/SendScheduledPush'
import { appTodayIso } from '@/lib/calendarDate'
import { loadData } from '@/application/usecases/LoadData'
import { digestPush, weeklyDigest } from './digest'

export const { GET, POST } = scheduledRoute('weekly-digest', async () => {
  await loadData()
  const today = appTodayIso()
  const push = digestPush(
    weeklyDigest({
      today,
      activities: getActivitySummaries(),
      planned: await getPlannedWorkouts(),
      coaching: getCoachingOverview(today),
      recovery: getRecoveryHistory(),
      crossTraining: getCrossTrainingEntries(),
    })
  )
  if (!push) return NextResponse.json({ sent: false })

  const sent = await sendOncePer('weeklyDigest', today, () => sendPush('training', { ...push, link: pushPaths.plan, tag: 'weekly-digest' }))
  return NextResponse.json(sent ? { sent: true } : { skipped: 'already sent today' })
})
