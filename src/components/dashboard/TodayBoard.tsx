import { TodaySessionCard } from './TodaySessionCard'
import type { SessionCard } from './nextSession'

/**
 * The day under the readiness card: the next workout. The last run's row is
 * gone (3.0.2, mock 5f): it is the top of Activities, and without it the
 * load strip clears the tab bar.
 */
export function TodayBoard({ session }: { session: SessionCard | null }) {
  return (
    <div className="flex flex-col gap-3" data-testid="today-board">
      {session && <TodaySessionCard card={session} />}
    </div>
  )
}
