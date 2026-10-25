import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'

/**
 * firestore.rules alone stands between the public web config and the database.
 * Needs the Firestore emulator (`npm run test:rules`); a plain `npm test` skips the suite.
 */
const emulator = process.env.FIRESTORE_EMULATOR_HOST

describe.skipIf(!emulator)('firestore.rules', () => {
  let env: RulesTestEnvironment

  beforeAll(async () => {
    const [host, port] = (emulator ?? '').split(':')
    env = await initializeTestEnvironment({
      projectId: 'demo-runomics',
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(path.resolve(__dirname, '../../../firestore.rules'), 'utf8'),
      },
    })
  })

  afterAll(async () => {
    await env?.cleanup()
  })

  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'activityNotes', '101'), { note: 'Felt sick', tags: ['illness'] })
      await setDoc(doc(db, 'routeNames', 'route-1'), { name: 'Moselle riverside loop' })
      await setDoc(doc(db, 'wellness', '2026-10-24'), { sleep: 2, soreness: 4, ill: true })
      await setDoc(doc(db, 'pushTokens', 'token-1'), { token: 'token-1', userAgent: 'iPhone' })
      await setDoc(doc(db, 'aiInsights', 'today'), { text: 'x' })
    })
  })

  const visitor = () => env.unauthenticatedContext().firestore()
  const stranger = () => env.authenticatedContext('stranger', { email: 'someone@example.com' }).firestore()
  const owner = () => env.authenticatedContext('owner', { owner: true }).firestore()

  describe('activityNotes', () => {
    // The activity page reads notes through the app, so a private site's
    // gate covers them; straight from Firestore, only the owner may.
    it('lets only the owner read a note by id', async () => {
      await assertFails(getDoc(doc(visitor(), 'activityNotes', '101')))
      await assertFails(getDoc(doc(stranger(), 'activityNotes', '101')))
      await assertSucceeds(getDoc(doc(owner(), 'activityNotes', '101')))
    })

    it('never lets anyone but the owner list them', async () => {
      await assertFails(getDocs(collection(visitor(), 'activityNotes')))
      await assertFails(getDocs(collection(stranger(), 'activityNotes')))
      await assertSucceeds(getDocs(collection(owner(), 'activityNotes')))
    })

    it('only lets the owner write, and only a well-formed note', async () => {
      const note = { note: 'Easy run', tags: ['easy'] }
      await assertFails(setDoc(doc(visitor(), 'activityNotes', '102'), note))
      await assertFails(setDoc(doc(stranger(), 'activityNotes', '102'), note))
      await assertSucceeds(setDoc(doc(owner(), 'activityNotes', '102'), note))
    })

    it('rejects a note the client would never send', async () => {
      const db = owner()
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: 'x', tags: [], extra: true }))
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: 'x'.repeat(501), tags: [] }))
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: 'x', tags: Array(11).fill('t') }))
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: 42, tags: [] }))
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: 'x', tags: 'easy' }))
    })

    it('only lets the owner delete', async () => {
      await assertFails(deleteDoc(doc(stranger(), 'activityNotes', '101')))
      await assertSucceeds(deleteDoc(doc(owner(), 'activityNotes', '101')))
    })
  })

  describe('routeNames', () => {
    it('lets only the owner read and list them', async () => {
      await assertFails(getDoc(doc(visitor(), 'routeNames', 'route-1')))
      await assertFails(getDocs(collection(stranger(), 'routeNames')))
      await assertSucceeds(getDoc(doc(owner(), 'routeNames', 'route-1')))
      await assertSucceeds(getDocs(collection(owner(), 'routeNames')))
    })

    it('only lets the owner write, and only a well-formed name', async () => {
      await assertFails(setDoc(doc(stranger(), 'routeNames', 'route-2'), { name: 'Theirs' }))
      await assertSucceeds(setDoc(doc(owner(), 'routeNames', 'route-2'), { name: 'Hill loop' }))

      const db = owner()
      await assertFails(setDoc(doc(db, 'routeNames', 'route-3'), { name: '' }))
      await assertFails(setDoc(doc(db, 'routeNames', 'route-3'), { name: 'x'.repeat(81) }))
      await assertFails(setDoc(doc(db, 'routeNames', 'route-3'), { name: 42 }))
      await assertFails(setDoc(doc(db, 'routeNames', 'route-3'), { name: 'x', extra: true }))
    })

    it('only lets the owner clear one', async () => {
      await assertFails(deleteDoc(doc(stranger(), 'routeNames', 'route-1')))
      await assertSucceeds(deleteDoc(doc(owner(), 'routeNames', 'route-1')))
    })
  })

  describe('wellness', () => {
    const checkIn = { sleep: 4, soreness: 2, stress: 3, mood: 5, travel: true, niggle: { site: 'calf', side: 'left', pain: 3, changesRun: false } }

    it('lets only the owner read and list check-ins', async () => {
      await assertFails(getDoc(doc(visitor(), 'wellness', '2026-10-24')))
      await assertFails(getDoc(doc(stranger(), 'wellness', '2026-10-24')))
      await assertFails(getDocs(collection(stranger(), 'wellness')))
      await assertSucceeds(getDoc(doc(owner(), 'wellness', '2026-10-24')))
      await assertSucceeds(getDocs(collection(owner(), 'wellness')))
    })

    it('only lets the owner write a day, and only a well-formed check-in', async () => {
      await assertFails(setDoc(doc(visitor(), 'wellness', '2026-10-25'), checkIn))
      await assertFails(setDoc(doc(stranger(), 'wellness', '2026-10-25'), checkIn))
      await assertSucceeds(setDoc(doc(owner(), 'wellness', '2026-10-25'), checkIn))
      await assertSucceeds(setDoc(doc(owner(), 'wellness', '2026-10-25'), { sleep: 1 }))
      await assertSucceeds(deleteDoc(doc(owner(), 'wellness', '2026-10-25')))
    })

    it('rejects a check-in the client would never send', async () => {
      const db = owner()
      await assertFails(setDoc(doc(db, 'wellness', 'today'), { sleep: 3 }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { sleep: 6 }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { mood: 2.5 }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { ill: 'yes' }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { sleep: 3, note: 'free text' }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { niggle: { site: 'elbow', pain: 3 } }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { niggle: { site: 'knee', pain: 11 } }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { niggle: { site: 'knee' } }))
      await assertFails(setDoc(doc(db, 'wellness', '2026-10-25'), { niggle: { site: 'knee', pain: 2, side: 'both' } }))
    })
  })

  describe('pushTokens', () => {
    const device = { token: 'token-2', userAgent: 'iPhone', categories: { training: true, shoes: false, records: true } }

    it('lets only the owner register a device', async () => {
      await assertFails(setDoc(doc(visitor(), 'pushTokens', 'token-2'), device))
      await assertFails(setDoc(doc(stranger(), 'pushTokens', 'token-2'), device))
      await assertSucceeds(setDoc(doc(owner(), 'pushTokens', 'token-2'), device))
      await assertSucceeds(deleteDoc(doc(owner(), 'pushTokens', 'token-2')))
    })

    it('takes only on-off switches for the known categories, on the token they name', async () => {
      await assertSucceeds(setDoc(doc(owner(), 'pushTokens', 'token-1'), { token: 'token-1', userAgent: 'iPhone' }))
      await assertFails(setDoc(doc(owner(), 'pushTokens', 'token-2'), { ...device, token: 'token-3' }))
      await assertFails(setDoc(doc(owner(), 'pushTokens', 'token-2'), { ...device, categories: { training: 'yes' } }))
      await assertFails(setDoc(doc(owner(), 'pushTokens', 'token-2'), { ...device, categories: { ...device.categories, all: true } }))
      await assertFails(setDoc(doc(owner(), 'pushTokens', 'token-2'), { ...device, admin: true }))
    })

    it('never lets a client read the device tokens back', async () => {
      await assertFails(getDoc(doc(visitor(), 'pushTokens', 'token-1')))
      await assertFails(getDoc(doc(owner(), 'pushTokens', 'token-1')))
      await assertFails(getDocs(collection(owner(), 'pushTokens')))
    })
  })

  it('denies every other collection to every client, owner included', async () => {
    // AI insights, the AI budget and the notification dedup state are written
    // by the Admin SDK only, which the rules do not govern.
    await assertFails(getDoc(doc(visitor(), 'aiInsights', 'today')))
    await assertFails(getDoc(doc(owner(), 'aiInsights', 'today')))
    await assertFails(setDoc(doc(owner(), 'aiBudget', 'day'), { spent: 0 }))
  })
})
