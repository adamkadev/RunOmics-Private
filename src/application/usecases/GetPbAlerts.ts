import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getRecords } from './GetRecords'

const RECENT_WINDOW_DAYS = 45
const CLOSE_THRESHOLD = 0.03

export interface PbAlert {
  key: string
  label: string
  recordSeconds: number
  recentSeconds: number
  diffSeconds: number
  activityId: string
  date: string
}

export async function getPbAlerts(): Promise<PbAlert[]> {
  const records = await getRecords()
  const activities = getAllActivities()
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const alerts: PbAlert[] = []

  for (const record of records) {
    if (record.key === 'longest' || record.seconds == null) continue

    let best: { seconds: number; activityId: string; date: string } | null = null
    for (const a of activities) {
      if (a.id === record.activityId) continue
      if (new Date(a.date).getTime() < cutoff) continue
      const sec = a.bestEfforts?.[record.key]
      if (sec != null && (best === null || sec < best.seconds)) {
        best = { seconds: Math.round(sec), activityId: a.id, date: a.date }
      }
    }
    if (!best || best.seconds <= record.seconds) continue

    const diffSeconds = best.seconds - record.seconds
    if (diffSeconds / record.seconds > CLOSE_THRESHOLD) continue

    alerts.push({
      key: record.key,
      label: record.label,
      recordSeconds: record.seconds,
      recentSeconds: best.seconds,
      diffSeconds,
      activityId: best.activityId,
      date: best.date,
    })
  }

  return alerts.sort((a, b) => a.diffSeconds / a.recordSeconds - b.diffSeconds / b.recordSeconds)
}
