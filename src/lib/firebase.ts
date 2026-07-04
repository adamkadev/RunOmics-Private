import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
}

/** Firestore-backed features (notes, push settings) no-op when the public config is absent. */
export const isClientFirebaseConfigured = Boolean(firebaseConfig.apiKey)

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
