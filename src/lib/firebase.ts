import { getFirestore } from 'firebase/firestore'

import { getClientApp } from './firebaseApp'

export { isClientFirebaseConfigured } from './firebaseConfig'
export { getClientApp }

export function getClientFirestore() {
  return getFirestore(getClientApp())
}
