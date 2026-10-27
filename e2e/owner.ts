import { expect, test, type Page } from '@playwright/test'

export const AUTH_EMULATOR_HOST = '127.0.0.1:9099'
export const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
export const EMULATORS_COMMAND = 'npx -y firebase-tools@15.31.0 emulators:start --only auth,firestore --project runomics-dev'

const PROJECT_ID = 'runomics-dev'
const OWNER = { sub: 'e2e-owner', email: 'owner@example.com', name: 'E2E Owner' }
const AUTH = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
const DOCUMENTS = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`
// Both emulators take "Bearer owner" as an admin token, which passes over the Firestore rules.
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Emulator ${url} answered ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

interface IdpSession { localId: string; idToken: string; refreshToken: string; expiresIn: string }

async function signInWithIdp(): Promise<IdpSession> {
  // The emulator accepts an unsigned JSON id_token for a federated sign-in.
  const idToken = encodeURIComponent(JSON.stringify({ ...OWNER, email_verified: true }))
  return call<IdpSession>(`${AUTH}/accounts:signInWithIdp?key=emulator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody: `id_token=${idToken}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }),
  })
}

/** A session whose ID token carries the `owner` claim, as the Auth SDK keeps it between page loads. */
async function ownerSession(apiKey: string) {
  const { localId } = await signInWithIdp()
  await call(`${AUTH}/projects/${PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ localId, customAttributes: JSON.stringify({ owner: true }) }),
  })
  // Signed in again, so the token is minted after the claim.
  const session = await signInWithIdp()
  const now = String(Date.now())
  return {
    uid: session.localId,
    email: OWNER.email,
    emailVerified: true,
    displayName: OWNER.name,
    isAnonymous: false,
    providerData: [{ providerId: 'google.com', uid: OWNER.sub, displayName: OWNER.name, email: OWNER.email, phoneNumber: null, photoURL: null }],
    stsTokenManager: {
      refreshToken: session.refreshToken,
      accessToken: session.idToken,
      expirationTime: Date.now() + Number(session.expiresIn) * 1000,
    },
    createdAt: now,
    lastLoginAt: now,
    apiKey,
    appName: '[DEFAULT]',
  }
}

/**
 * Signed in as the Auth SDK finds a returning owner, rather than through Google's popup, whose script comes from
 * apis.google.com even against the emulator. Every page the test opens from then on is the owner's.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  // The public demo's .env.e2e has no Firebase web config, so its build has no owner to sign in.
  if (!apiKey) return test.skip(true, 'NEXT_PUBLIC_FIREBASE_API_KEY is unset: no owner to sign in')
  const session = await ownerSession(apiKey)
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value)
      } catch {}
    },
    [`firebase:authUser:${apiKey}:[DEFAULT]`, JSON.stringify(session)] as const,
  )
  await page.goto('/settings')
  // The owner's Data card only renders once the claim has been read.
  await expect(page.getByTestId('data-card')).toBeVisible()
}

type FirestoreValue = { stringValue?: string; booleanValue?: boolean; integerValue?: string; arrayValue?: { values?: FirestoreValue[] } }

/** A document's fields as the emulator stores them, or null when there is none. */
export async function readDocument(path: string): Promise<Record<string, FirestoreValue> | null> {
  const res = await fetch(`${DOCUMENTS}/${path}`, { headers: ADMIN })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Emulator read of ${path} answered ${res.status}`)
  return ((await res.json()) as { fields?: Record<string, FirestoreValue> }).fields ?? {}
}

export async function deleteDocument(path: string): Promise<void> {
  const res = await fetch(`${DOCUMENTS}/${path}`, { method: 'DELETE', headers: ADMIN })
  if (!res.ok && res.status !== 404) throw new Error(`Emulator delete of ${path} answered ${res.status}`)
}

export async function listDocuments(collection: string): Promise<{ id: string; fields: Record<string, FirestoreValue> }[]> {
  const { documents = [] } = await call<{ documents?: { name: string; fields?: Record<string, FirestoreValue> }[] }>(
    `${DOCUMENTS}/${collection}?pageSize=300`,
    { headers: ADMIN },
  )
  return documents.map((doc) => ({ id: doc.name.split('/').pop()!, fields: doc.fields ?? {} }))
}

/** Each test clears what it writes: the emulator outlives a local run, and both builds share it. */
export async function clearCollection(collection: string): Promise<void> {
  await Promise.all((await listDocuments(collection)).map((doc) => deleteDocument(`${collection}/${doc.id}`)))
}
