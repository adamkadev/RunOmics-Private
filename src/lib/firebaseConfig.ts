/**
 * The web config and whether it is set, without the SDK. lib/firebase imports
 * firebase/app, auth and firestore, so a component that only asks "is Firebase
 * configured?" asks here, and the SDKs stay out of its first load until it
 * actually calls one.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
}

export const isClientFirebaseConfigured = Boolean(firebaseConfig.apiKey)
