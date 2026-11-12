import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { HealthDay, HealthNight } from '@/domain/training/recovery'

type Stored = { days?: Record<string, unknown> }

const DAY_MINUTES = 24 * 60

const within = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

function readNight(raw: unknown): HealthNight | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const n = raw as Record<string, unknown>
  if (typeof n.start !== 'string' || typeof n.end !== 'string' || !within(n.asleepMinutes, 1, DAY_MINUTES)) return undefined
  const night: HealthNight = {
    start: n.start,
    end: n.end,
    asleepMinutes: n.asleepMinutes,
    awakeMinutes: within(n.awakeMinutes, 0, DAY_MINUTES) ? n.awakeMinutes : 0,
  }
  for (const key of ['deepMinutes', 'remMinutes', 'lightMinutes'] as const) {
    if (within(n[key], 0, DAY_MINUTES)) night[key] = n[key]
  }
  return night
}

function readDay(date: string, raw: unknown): HealthDay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof raw !== 'object' || raw === null) return null
  const d = raw as Record<string, unknown>
  const day: HealthDay = { date }
  if (within(d.restingHr, 30, 100)) day.restingHr = d.restingHr
  if (within(d.hrvMs, 1, 300)) day.hrvMs = d.hrvMs
  if (within(d.steps, 0, 200_000)) day.steps = d.steps
  const sleep = readNight(d.sleep)
  if (sleep) day.sleep = sleep
  return Object.keys(day).length > 1 ? day : null
}

/** The tracker's days, oldest first; empty for a deployment without one. A malformed reading is dropped, not shown. */
export function getHealthDays(): HealthDay[] {
  const stored = readJsonFile<Stored>(dataPath('health_history.json'), {})
  return Object.entries(stored.days ?? {})
    .flatMap(([date, raw]) => readDay(date, raw) ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
}
