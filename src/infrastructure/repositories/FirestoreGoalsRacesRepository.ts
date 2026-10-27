import { getAdminFirestore } from '@/lib/firebase-admin'
import { GOAL_ENTRIES_COLLECTION, RACE_ENTRIES_COLLECTION } from '@/lib/goalsRaces'
import { readGoalEntry, readRaceEntry, type GoalEntry, type RaceEntry } from '@/domain/goals/entries'
import { withTimeout } from '@/lib/withTimeout'

/** The nightly backup's first Firestore call is cold. */
const READ_TIMEOUT_MS = 10_000

export interface GoalsRacesRead {
  races: RaceEntry[]
  goals: GoalEntry[]
  available: boolean
}

const UNAVAILABLE: GoalsRacesRead = { races: [], goals: [], available: false }

export async function getGoalsRacesEntries(): Promise<GoalsRacesRead> {
  if (!process.env.FIREBASE_PROJECT_ID) return UNAVAILABLE

  try {
    const db = getAdminFirestore()
    const read = await withTimeout(
      Promise.all([db.collection(RACE_ENTRIES_COLLECTION).get(), db.collection(GOAL_ENTRIES_COLLECTION).get()]),
      READ_TIMEOUT_MS,
      null
    )
    if (!read) return UNAVAILABLE
    const [races, goals] = read
    return {
      races: races.docs.flatMap((doc) => readRaceEntry(doc.id, doc.data()) ?? []),
      goals: goals.docs.flatMap((doc) => readGoalEntry(doc.id, doc.data()) ?? []),
      available: true,
    }
  } catch {
    return UNAVAILABLE
  }
}
