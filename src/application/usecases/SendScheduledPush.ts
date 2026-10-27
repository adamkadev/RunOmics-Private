import { claimNotificationKey, releaseNotificationKey } from '@/infrastructure/repositories/FirestoreConfigRepository'

export type ScheduledPush = 'dailySession' | 'weeklyReminder' | 'weeklyDigest' | 'coachBlock' | 'goalYear'

const DOCUMENT: Record<ScheduledPush, string> = {
  dailySession: 'lastDailySession',
  weeklyReminder: 'lastWeeklyReminder',
  weeklyDigest: 'lastWeeklyDigest',
  coachBlock: 'lastCoachBlock',
  goalYear: 'lastGoalYear',
}

/** Once per key: Vercel Cron may deliver a run twice, and a run by hand may follow the cron's. False when already sent. */
export async function sendOncePer(push: ScheduledPush, key: string, send: () => Promise<unknown>): Promise<boolean> {
  if (!(await claimNotificationKey(DOCUMENT[push], key))) return false
  try {
    await send()
  } catch (error) {
    await releaseNotificationKey(DOCUMENT[push], key).catch(() => {})
    throw error
  }
  return true
}
