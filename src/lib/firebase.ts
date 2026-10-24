import { getFirestore } from 'firebase/firestore'

import { getClientApp } from './firebaseAuth'

export { isClientFirebaseConfigured } from './firebaseConfig'
export { getClientApp, getClientAuth } from './firebaseAuth'

export function getClientFirestore() {
  return getFirestore(getClientApp())
}
