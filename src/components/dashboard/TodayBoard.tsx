import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { LastRunRow } from './LastRunRow'
import { TodaySessionCard } from './TodaySessionCard'
import type { LastRun } from './nextSession'

export interface SessionCardData {
  eyebrow: string
  title: string
  workout: HeroWorkoutView | null
  hrCapBpm: number | null
}

export function TodayBoard({ session, lastRun = null }: { session: SessionCardData | null; lastRun?: LastRun | null }) {
  const card = session && (
    <TodaySessionCard eyebrow={session.eyebrow} title={session.title} workout={session.workout} hrCapBpm={session.hrCapBpm} />
  )
  const row = lastRun && <LastRunRow run={lastRun} />
  const runFirst = lastRun?.layout === 'done'

  return (
    <div className="flex flex-col gap-3.5" data-testid="today-board">
      {runFirst ? row : card}
      {runFirst ? card : row}
    </div>
  )
}
