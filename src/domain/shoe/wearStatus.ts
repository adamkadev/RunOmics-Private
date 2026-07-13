export type WearStatus = 'ok' | 'watch' | 'replace'

export function wearStatus(pct: number): WearStatus {
  if (pct >= 90) return 'replace'
  if (pct >= 70) return 'watch'
  return 'ok'
}
