/** An iPhone keeps a home-screen app's page alive for days: back after this long, it checks for a newer deploy. */
export const AWAY_BEFORE_CHECK_MS = 60_000

/** An open sheet or panel counts too: the keyboard's Done blurs the field and leaves its draft on screen. */
export function editing(doc: Pick<Document, 'activeElement' | 'querySelector'>): boolean {
  const el = doc.activeElement as HTMLElement | null
  const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true
  return typing || doc.querySelector('[role="dialog"]') !== null
}

/** A field being typed in is never thrown away for an update; the next return will catch it. */
export function shouldReload({ awayMs, ownBuild, liveBuild, editing }: { awayMs: number; ownBuild: string; liveBuild: string | null; editing: boolean }): boolean {
  if (editing || awayMs < AWAY_BEFORE_CHECK_MS) return false
  if (!liveBuild || ownBuild === 'local' || liveBuild === 'local') return false
  return liveBuild !== ownBuild
}
