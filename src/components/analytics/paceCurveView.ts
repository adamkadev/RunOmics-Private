import { bestCurve, criticalSpeed, paceOf, type CriticalSpeed, type CurvePoint, type RunBests } from '@/domain/activity/paceCurve'
import { addDays, isoDate } from '@/lib/calendarDate'
import type { DayWindow } from './analyticsView'

export interface PaceCurveRow {
  seconds: number
  now: { pace: number; date: string } | null
  before: { pace: number; date: string } | null
}

export interface PaceCurveView {
  rows: PaceCurveRow[]
  cs: CriticalSpeed | null
  /** Whole seconds a km, negative when critical speed got faster than the window before. */
  csDelta: number | null
  /** The watch's threshold pace on the window's last day. */
  threshold: number | null
  /** Critical speed's pace minus the threshold pace: negative is faster. */
  vsThreshold: number | null
}

const point = (p: CurvePoint | undefined) => (p ? { pace: paceOf(p), date: p.date } : null)

export function paceCurveView(runs: readonly RunBests[], window: DayWindow, threshold: readonly { date: string; pace: number }[]): PaceCurveView | null {
  const now = bestCurve(runs, window)
  if (now.length < 2) return null
  const day = (iso: string) => new Date(`${iso}T00:00:00`)
  const before = bestCurve(runs, { start: isoDate(addDays(day(window.start), -window.days)), end: isoDate(addDays(day(window.start), -1)) })
  const seconds = [...new Set([...now, ...before].map((p) => p.seconds))].sort((a, b) => a - b)
  const cs = criticalSpeed(now)
  const csBefore = criticalSpeed(before)
  const thresholdPace = threshold.filter((p) => p.date <= window.end).at(-1)?.pace ?? null
  return {
    rows: seconds.map((s) => ({ seconds: s, now: point(now.find((p) => p.seconds === s)), before: point(before.find((p) => p.seconds === s)) })),
    cs,
    csDelta: cs && csBefore ? Math.round(cs.paceSecPerKm) - Math.round(csBefore.paceSecPerKm) : null,
    threshold: thresholdPace,
    vsThreshold: cs && thresholdPace ? Math.round(cs.paceSecPerKm) - thresholdPace : null,
  }
}
