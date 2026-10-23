#!/usr/bin/env node

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

// The claim is looked up by email, so the account must be one Google vouches for: with another provider enabled,
// anyone could register the owner's address first, unverified.
const signsInWithGoogle = user.providerData.some((provider) => provider.providerId === 'google.com')
const reasons = [
  ...(user.emailVerified ? [] : ['its email is not verified']),
  ...(signsInWithGoogle ? [] : ['it has never signed in with Google']),
]
if (reasons.length) {
  console.error(
    `Refusing to grant the owner claim to ${email} (uid: ${user.uid}): ${reasons.join(' and ')}. ` +
      'Sign in to the app with that Google account first, then re-run.'
  )
  process.exit(1)
}

await auth.setCustomUserClaims(user.uid, { ...user.customClaims, owner: true })

console.log(`Granted the "owner" custom claim to ${email} (uid: ${user.uid}).`)
console.log('Sign out and back in on this account for a fresh ID token to carry the claim.')
