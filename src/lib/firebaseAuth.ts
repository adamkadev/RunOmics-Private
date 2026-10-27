import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'

import { getClientApp } from './firebaseApp'

// Apart from lib/firebase: the owner check runs on every page, and Firestore is 168 KB it does not use.

// Set only by the e2e and screenshot builds, to sign in without a real Google account; refused on Vercel.
const AUTH_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
let clientAuth: Auth | undefined

/** Not getAuth: its popup resolver has iOS load Google's sign-in iframe before the account is even read. */
export function getClientAuth({ forSignIn = false } = {}): Auth {
  if (clientAuth) return clientAuth
  const app = getClientApp()
  try {
    clientAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      // Ready before the tap, as Safari blocks a popup opened after a wait for Google's iframe.
      ...(forSignIn ? { popupRedirectResolver: browserPopupRedirectResolver } : {}),
    })
  } catch {
    // A hot reload runs this module again after the app's Auth exists.
    clientAuth = getAuth(app)
  }
  if (AUTH_EMULATOR_HOST) connectAuthEmulator(clientAuth, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  return clientAuth
}
