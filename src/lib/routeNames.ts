import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'

/**
 * A route is found by its shape, not an id the import carries, so a name is
 * stored against its fingerprint, which survives a new run joining the cluster.
 */
export const ROUTE_NAMES_COLLECTION = 'routeNames'

export const ROUTE_NAME_MAX_LENGTH = 80

/** Rounded coarsely enough that another run of the same route lands on the same key. */
export function routeKey(route: {
  start: readonly [number, number] | null
  far: readonly [number, number] | null
  distanceKm: number
}): string | null {
  if (!route.start || !route.far) return null
  const at = (coord: readonly [number, number]) => `${coord[0].toFixed(3)},${coord[1].toFixed(3)}`
  return `${at(route.start)}:${at(route.far)}:${route.distanceKm.toFixed(0)}`
}

async function store() {
  const [firestore, { getClientFirestore }] = await Promise.all([
    import('firebase/firestore'),
    import('@/lib/firebase'),
  ])
  return { firestore, db: getClientFirestore() }
}

export async function readRouteNames(): Promise<Map<string, string>> {
  if (!isClientFirebaseConfigured) return new Map()
  try {
    const { firestore: { collection, getDocs }, db } = await store()
    const snapshot = await getDocs(collection(db, ROUTE_NAMES_COLLECTION))
    const names = new Map<string, string>()
    snapshot.forEach((entry) => {
      const name = (entry.data() as { name?: unknown }).name
      if (typeof name === 'string' && name.trim() !== '') names.set(entry.id, name)
    })
    return names
  } catch {
    // No names rather than an error: the list still has its places.
    return new Map()
  }
}

/** An empty name clears it back to the place the route is named after. */
export async function writeRouteName(key: string, name: string): Promise<void> {
  const { firestore: { doc, deleteDoc, setDoc }, db } = await store()
  const trimmed = name.trim().slice(0, ROUTE_NAME_MAX_LENGTH)
  const ref = doc(db, ROUTE_NAMES_COLLECTION, key)
  if (trimmed === '') await deleteDoc(ref)
  else await setDoc(ref, { name: trimmed })
}
