import { LastRunRow } from './LastRunRow'
import { TodaySessionCard } from './TodaySessionCard'
import type { LastRun, SessionCard } from './nextSession'

/**
 * The day under the readiness card: the next workout, then the run behind
 * it - or, once today's run is done, that run first and what comes next.
 */
export function TodayBoard({ session, lastRun = null }: { session: SessionCard | null; lastRun?: LastRun | null }) {
  const card = session && <TodaySessionCard card={session} />
  const row = lastRun && <LastRunRow run={lastRun} />
  const runFirst = lastRun?.when === 'today'

  return (
    <div className="flex flex-col gap-3" data-testid="today-board">
      {runFirst ? row : card}
      {runFirst ? card : row}
    </div>
  )
}
