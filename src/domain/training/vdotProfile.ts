import { secondsForVdot, vdotFromEffort } from '@/domain/training/vdot'
import { DAY_MS } from '@/lib/calendarDate'

export interface VdotRecordInput {
  key: string
  km: number
  seconds: number
  date: string | null
}

export interface VdotRow {
  key: string
  km: number
  seconds: number
  date: string | null
  vdot: number
  stale: boolean
}

export interface VdotEquivalent {
  key: string
  seconds: number | null
  worthSeconds: number
}

export type VdotLead = 'speed' | 'endurance' | 'even'

export interface VdotProfile {
  rows: VdotRow[]
  best: VdotRow
  /** The best record of the last six months, else the best: the level the equivalents are worked out at. */
  anchor: VdotRow
  lead: VdotLead
  /** Best short record against best long one, rounded to the VDOT. */
  gap: number
  /** The records on the trailing side old enough to be the reason they trail. */
  staleTrailing: VdotRow[]
  equivalents: VdotEquivalent[]
}

const MIN_KM = 1.5
const SHORT_MAX_KM = 5
const STALE_DAYS = 183
const EVEN_GAP = 2

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / DAY_MS
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function vdotProfile(records: readonly VdotRecordInput[], distances: readonly { key: string; km: number }[], today: string): VdotProfile | null {
  const rows: VdotRow[] = records
    .filter((r) => r.km >= MIN_KM && r.seconds > 0)
    .sort((a, b) => a.km - b.km)
    .map((r) => ({
      key: r.key,
      km: r.km,
      seconds: r.seconds,
      date: r.date,
      vdot: round1(vdotFromEffort(r.km, r.seconds)),
      stale: r.date !== null && daysBetween(r.date, today) > STALE_DAYS,
    }))
  if (rows.length < 2) return null

  const best = rows.reduce((a, b) => (b.vdot > a.vdot ? b : a))
  const short = rows.filter((r) => r.km <= SHORT_MAX_KM)
  const long = rows.filter((r) => r.km > SHORT_MAX_KM)
  let lead: VdotLead = 'even'
  let gap = 0
  let staleTrailing: VdotRow[] = []
  if (short.length && long.length) {
    const topShort = Math.max(...short.map((r) => r.vdot))
    const topLong = Math.max(...long.map((r) => r.vdot))
    gap = Math.round(Math.abs(topShort - topLong))
    if (Math.abs(topShort - topLong) > EVEN_GAP) {
      lead = topShort > topLong ? 'speed' : 'endurance'
      staleTrailing = (lead === 'speed' ? long : short).filter((r) => r.stale)
    }
  }

  const recent = rows.filter((r) => !r.stale)
  const anchor = recent.length ? recent.reduce((a, b) => (b.vdot > a.vdot ? b : a)) : best
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const equivalents = distances
    .filter((d) => d.km >= SHORT_MAX_KM && d.key !== anchor.key)
    .map((d) => ({ key: d.key, seconds: byKey.get(d.key)?.seconds ?? null, worthSeconds: secondsForVdot(anchor.vdot, d.km) }))
    .filter((e) => e.seconds === null || e.worthSeconds < e.seconds)

  return { rows, best, anchor, lead, gap, staleTrailing, equivalents }
}
