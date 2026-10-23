import { TodaySessionCard } from './TodaySessionCard'
import type { SessionCard } from './nextSession'

/** No last-run row: it is the top of Activities, and without it the load strip clears the tab bar. */
export function TodayBoard({ session }: { session: SessionCard | null }) {
  return (
    <div className="flex flex-col gap-3" data-testid="today-board">
      {session && <TodaySessionCard card={session} />}
    </div>
  )
}
