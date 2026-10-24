/** An iPhone keeps a home-screen app's page alive for days: back after this long, it checks for a newer deploy. */
export const AWAY_BEFORE_CHECK_MS = 60_000

/** A field being typed in is never thrown away for an update; the next return will catch it. */
export function shouldReload({ awayMs, ownBuild, liveBuild, editing }: { awayMs: number; ownBuild: string; liveBuild: string | null; editing: boolean }): boolean {
  if (editing || awayMs < AWAY_BEFORE_CHECK_MS) return false
  if (!liveBuild || ownBuild === 'local' || liveBuild === 'local') return false
  return liveBuild !== ownBuild
}
