import type { RecordEntry } from '@/domain/race/records'
import type { Activity } from '@/domain/activity/types'
import { EFFORTS } from '@/domain/activity/effort'
import { isRunWalk } from '@/domain/activity/runWalk'
import { vdotProfile, type VdotProfile } from '@/domain/training/vdotProfile'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { appTodayIso } from '@/lib/calendarDate'

export type { VdotProfile } from '@/domain/training/vdotProfile'

/** A run/walk record says nothing about running speed, so any one of them hides the card. */
export function buildVdotProfile(records: readonly RecordEntry[], activities: readonly Activity[], today: string): VdotProfile | null {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const km = new Map(EFFORTS.map((e) => [e.key, e.km]))
  const inputs = []
  for (const r of records) {
    const distance = km.get(r.key)
    if (r.seconds === null || distance === undefined) continue
    const activity = r.activityId ? byId.get(r.activityId) : undefined
    if (activity && isRunWalk(activity, null)) return null
    inputs.push({ key: r.key, km: distance, seconds: r.seconds, date: r.date })
  }
  return vdotProfile(inputs, EFFORTS, today)
}

export function getVdotProfile(records: readonly RecordEntry[], today: string = appTodayIso()): VdotProfile | null {
  return buildVdotProfile(records, getAllActivities(), today)
}
