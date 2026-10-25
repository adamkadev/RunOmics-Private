import { initializeApp, getApps } from 'firebase/app'

import { firebaseConfig } from './firebaseConfig'

export function getClientApp() {
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp(firebaseConfig)
}
