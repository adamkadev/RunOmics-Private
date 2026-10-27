import {
  garminEntryId,
  goalEntryDoc,
  raceEntryDoc,
  readGoalEntry,
  readRaceEntry,
  type GoalEntry,
  type RaceEntry,
  type RaceFields,
} from '@/domain/goals/entries'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'

export const RACE_ENTRIES_COLLECTION = 'raceEntries'
export const GOAL_ENTRIES_COLLECTION = 'goalEntries'

export interface GoalsRacesEntries {
  races: RaceEntry[]
  goals: GoalEntry[]
}

async function store() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

/** Throws when Firestore cannot be read: an empty editor would invite re-adding races that exist. */
export async function readGoalsRacesEntries(): Promise<GoalsRacesEntries> {
  if (!isClientFirebaseConfigured) return { races: [], goals: [] }
  const { firestore: { collection, getDocs }, db } = await store()
  const [races, goals] = await Promise.all([
    getDocs(collection(db, RACE_ENTRIES_COLLECTION)),
    getDocs(collection(db, GOAL_ENTRIES_COLLECTION)),
  ])
  return {
    races: races.docs.flatMap((entry) => readRaceEntry(entry.id, entry.data()) ?? []),
    goals: goals.docs.flatMap((entry) => readGoalEntry(entry.id, entry.data()) ?? []),
  }
}

/** A synced race is edited under its own overlay id; an app race keeps the id it was given. */
export async function saveRace(fields: RaceFields, target: { id?: string; garminKey?: string }): Promise<void> {
  const { firestore: { addDoc, collection, doc, setDoc }, db } = await store()
  if (target.garminKey) {
    const entry: RaceEntry = { id: garminEntryId(target.garminKey), garminKey: target.garminKey, ...fields }
    await setDoc(doc(db, RACE_ENTRIES_COLLECTION, entry.id), raceEntryDoc(entry))
  } else if (target.id) {
    await setDoc(doc(db, RACE_ENTRIES_COLLECTION, target.id), raceEntryDoc({ id: target.id, ...fields }))
  } else {
    await addDoc(collection(db, RACE_ENTRIES_COLLECTION), raceEntryDoc({ id: '', ...fields }))
  }
}

/** Garmin would sync a deleted race back, so a synced one is hidden by a marker rather than deleted. */
export async function removeRace(target: { id?: string; garminKey?: string }): Promise<void> {
  const { firestore: { deleteDoc, doc, setDoc }, db } = await store()
  if (target.garminKey) {
    const entry: RaceEntry = { id: garminEntryId(target.garminKey), garminKey: target.garminKey, removed: true }
    await setDoc(doc(db, RACE_ENTRIES_COLLECTION, entry.id), raceEntryDoc(entry))
  } else if (target.id) {
    await deleteDoc(doc(db, RACE_ENTRIES_COLLECTION, target.id))
  }
}

export async function saveGoalYear(entry: GoalEntry): Promise<void> {
  const { firestore: { doc, setDoc }, db } = await store()
  await setDoc(doc(db, GOAL_ENTRIES_COLLECTION, String(entry.year)), goalEntryDoc(entry))
}
