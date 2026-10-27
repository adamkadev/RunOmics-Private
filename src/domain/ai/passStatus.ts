export interface ClosedModel {
  model: string
  reason: string
}

/** What an AI insight pass reports, as far as its status needs. */
export interface PassReport {
  freshVerdicts: { generated: number }
  today: { generated: boolean }
  pbCelebration: { generated: boolean }
  shoeVerdicts: Record<string, string>
  runVerdicts: { generated: number }
  missed: number
  closedModels: ClosedModel[]
}

/** The last pass, kept in Firestore for health and Settings → Diagnostics. An alias, for Firestore's DocumentData. */
export type AiPassStatus = {
  at: string
  generated: number
  missed: number
  closedModels: ClosedModel[]
  /** UTC dates of the passes in a row that wrote nothing while something was left to write. */
  idleDays: string[]
  alerted: boolean
}

/** Several passes run each night, so the alert counts nights, not passes. */
export const IDLE_NIGHTS_BEFORE_ALERT = 3

export function generatedCount(report: PassReport): number {
  const shoes = Object.values(report.shoeVerdicts).filter((result) => result === 'generated').length
  return report.freshVerdicts.generated + report.runVerdicts.generated + Number(report.today.generated) + Number(report.pbCelebration.generated) + shoes
}

export function nextPassStatus(report: PassReport, previous: AiPassStatus | null, now: Date): AiPassStatus {
  const generated = generatedCount(report)
  const idle = generated === 0 && report.missed > 0
  const day = now.toISOString().slice(0, 10)
  const before = idle ? (previous?.idleDays ?? []) : []
  const idleDays = idle && !before.includes(day) ? [...before, day] : before
  return {
    at: now.toISOString(),
    generated,
    missed: report.missed,
    closedModels: report.closedModels,
    idleDays,
    alerted: idle && (previous?.alerted ?? false),
  }
}

export function shouldAlert(status: AiPassStatus): boolean {
  return !status.alerted && status.idleDays.length >= IDLE_NIGHTS_BEFORE_ALERT
}
