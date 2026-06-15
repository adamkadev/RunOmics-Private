import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingLoad } from './GetTrainingLoad'
import { getRecords } from './GetRecords'
import { round } from '@/lib/math'
import { t } from '@/i18n'
import type { Activity, ActivityType } from '@/domain/activity/types'

export type InsightTone = 'positive' | 'warning' | 'info'

export interface Insight {
  id: string
  tone: InsightTone
  text: string
}

const EASY_TYPES: ActivityType[] = ['Base']
const MAX_INSIGHTS = 4
const VOLUME_STREAK_KM = 40
const DAY_MS = 86_400_000

function weightedEasyPace(acts: Activity[]): number | null {
  let weight = 0
  let sum = 0
  for (const a of acts) {
    if (!EASY_TYPES.includes(a.type) || a.paceSecPerKm == null || a.distanceKm <= 0) continue
    weight += a.distanceKm
    sum += a.paceSecPerKm * a.distanceKm
  }
  return weight ? sum / weight : null
}

function easyTimeShare(acts: Activity[]): number | null {
  let easy = 0
  let total = 0
  for (const a of acts) {
    for (const z of a.hrZones) {
      total += z.seconds
      if (z.zone <= 2) easy += z.seconds
    }
  }
  return total ? round((easy / total) * 100) : null
}

export function getInsights(): Insight[] {
  const all = getAllActivities()
  if (!all.length) return []

  const i = t.insights
  // Lower priority number = shown first (warnings before positives).
  const found: (Insight & { priority: number })[] = []
  const add = (priority: number, insight: Insight) => found.push({ priority, ...insight })

  // Anchor "now" to the most recent activity so insights work on static data too.
  const latest = all.reduce((max, a) => (a.date > max ? a.date : max), all[0].date)
  const refDate = new Date(latest + 'T00:00:00')
  const kmInLastDays = (n: number) => {
    const cutoff = refDate.getTime() - (n - 1) * DAY_MS
    return all
      .filter((a) => new Date(a.date + 'T00:00:00').getTime() >= cutoff)
      .reduce((s, a) => s + a.distanceKm, 0)
  }

  // --- Form (Training Stress Balance) ---
  const load = getTrainingLoad()
  if (load) {
    if (load.tsb > 8) add(10, { id: 'form-fresh', tone: 'positive', text: i.formFresh })
    else if (load.tsb < -30) add(1, { id: 'form-fatigued', tone: 'warning', text: i.formFatigued })
  }

  // --- Acute:chronic workload ratio (injury risk) ---
  const chronic = kmInLastDays(28) / 4
  if (chronic > 5) {
    const ratio = round(kmInLastDays(7) / chronic, 1)
    if (ratio >= 1.5) add(2, { id: 'acwr-high', tone: 'warning', text: i.acwrHigh(ratio) })
    else if (ratio >= 0.8 && ratio <= 1.3) add(20, { id: 'acwr-ok', tone: 'positive', text: i.acwrOptimal })
  }

  // --- Monthly aggregates ---
  const byMonth = new Map<string, Activity[]>()
  for (const a of all) {
    const key = a.date.slice(0, 7)
    const arr = byMonth.get(key) ?? []
    arr.push(a)
    byMonth.set(key, arr)
  }
  const months = Array.from(byMonth.keys()).sort()
  const thisMonth = byMonth.get(months[months.length - 1]) ?? []
  const lastMonth = months.length > 1 ? byMonth.get(months[months.length - 2]) ?? [] : []

  // Biggest training month
  if (months.length >= 3) {
    const totals = months.map((k) => round(byMonth.get(k)!.reduce((s, a) => s + a.distanceKm, 0)))
    const current = totals[totals.length - 1]
    const maxBefore = Math.max(...totals.slice(0, -1))
    if (current > 0 && current > maxBefore) {
      add(5, { id: 'month-record', tone: 'positive', text: i.monthlyRecord(current) })
    }
  }

  // Easy pace progression month over month
  const paceNow = weightedEasyPace(thisMonth)
  const pacePrev = weightedEasyPace(lastMonth)
  if (paceNow != null && pacePrev != null && pacePrev - paceNow >= 3) {
    add(6, { id: 'easy-pace', tone: 'positive', text: i.easyPaceImproved(Math.round(pacePrev - paceNow)) })
  }

  // Easy/hard balance (80/20)
  const share = easyTimeShare(thisMonth)
  if (share != null) {
    if (share < 65) add(3, { id: 'too-hard', tone: 'warning', text: i.tooHard(share) })
    else if (share >= 78 && share <= 88) add(15, { id: 'balanced', tone: 'positive', text: i.balanced(share) })
  }

  // Consecutive recent weeks over a volume threshold
  const byWeek = new Map<number, number>()
  for (const a of all) byWeek.set(a.week, (byWeek.get(a.week) ?? 0) + a.distanceKm)
  let streakWeeks = 0
  for (const w of Array.from(byWeek.keys()).sort((a, b) => b - a)) {
    if ((byWeek.get(w) ?? 0) >= VOLUME_STREAK_KM) streakWeeks++
    else break
  }
  if (streakWeeks >= 2) {
    add(7, { id: 'volume-streak', tone: 'positive', text: i.volumeStreak(streakWeeks, VOLUME_STREAK_KM) })
  }

  // Recent auto-detected personal best
  for (const r of getRecords()) {
    if (r.official || !r.date || !r.seconds) continue
    if (refDate.getTime() - new Date(r.date + 'T00:00:00').getTime() <= 30 * DAY_MS) {
      add(4, { id: `pr-${r.key}`, tone: 'positive', text: i.recentPr(r.label) })
      break
    }
  }

  return found
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ id, tone, text }) => ({ id, tone, text }))
}
