import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

import { getClientApp } from './firebaseApp'

export { isClientFirebaseConfigured } from './firebaseConfig'
export { getClientApp }

// Set only by the e2e build, whose owner writes to the emulator; next.config.ts refuses it on Vercel.
const FIRESTORE_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
let clientFirestore: Firestore | undefined

export function getClientFirestore() {
  if (clientFirestore) return clientFirestore
  clientFirestore = getFirestore(getClientApp())
  if (FIRESTORE_EMULATOR_HOST) {
    const [host, port] = FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(clientFirestore, host!, Number(port))
  }
  return clientFirestore
}
