import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

import { firebaseConfig } from './firebaseConfig'

export { isClientFirebaseConfigured } from './firebaseConfig'

export function getClientApp() {
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp(firebaseConfig)
}

export function getClientFirestore() {
  return getFirestore(getClientApp())
}

export function getClientAuth() {
  return getAuth(getClientApp())
}
