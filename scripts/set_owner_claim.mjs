#!/usr/bin/env node
// One-time (re-runnable) setup: grants the owner's Firebase Auth user the
// custom claim firestore.rules checks, instead of comparing a hardcoded
// email. Run once per Firebase project - dev and prod each need this run
// against their own project's credentials - and again if the owner ever
// signs in with a different Google account.
//
//   npm run set-owner-claim              # uses .env.local
//
// Needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (the
// same Admin SDK credential the app already uses) and NEXT_PUBLIC_OWNER_EMAIL
// in the environment. This mutates live Firebase Auth state - review the
// target project before running.

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.env.NEXT_PUBLIC_OWNER_EMAIL
if (!email) {
  console.error('NEXT_PUBLIC_OWNER_EMAIL is not set.')
  process.exit(1)
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

const auth = getAuth()
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, owner: true })

console.log(`Granted the "owner" custom claim to ${email} (uid: ${user.uid}).`)
console.log('Sign out and back in on this account for a fresh ID token to carry the claim.')
