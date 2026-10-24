import { initializeApp, getApps } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'

import { firebaseConfig } from './firebaseConfig'

// Apart from lib/firebase: the owner check runs on every page, and Firestore is 168 KB it does not use.

export function getClientApp() {
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp(firebaseConfig)
}

// Set only by the screenshot build, to sign in without a real Google account; dead code elsewhere.
const AUTH_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
let authEmulatorConnected = false

export function getClientAuth(): Auth {
  const auth = getAuth(getClientApp())
  if (AUTH_EMULATOR_HOST && !authEmulatorConnected) {
    connectAuthEmulator(auth, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    authEmulatorConnected = true
  }
  return auth
}
