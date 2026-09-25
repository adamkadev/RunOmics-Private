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
 * firestore.rules is the only thing standing between the public web config
 * (it ships in every page) and the database, so it is tested against the
 * real rules engine rather than read and trusted.
 *
 * Needs the Firestore emulator: `npm run test:rules` starts it and runs this
 * file. Under a plain `npm test` there is no emulator and the suite skips
 * itself rather than failing.
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
      await setDoc(doc(db, 'pushTokens', 'token-1'), { createdAt: 1 })
      await setDoc(doc(db, 'aiInsights', 'today'), { text: 'x' })
    })
  })

  const visitor = () => env.unauthenticatedContext().firestore()
  const stranger = () => env.authenticatedContext('stranger', { email: 'someone@example.com' }).firestore()
  const owner = () => env.authenticatedContext('owner', { owner: true }).firestore()

  describe('activityNotes', () => {
    it('lets anyone read one note by id, as the activity page does', async () => {
      await assertSucceeds(getDoc(doc(visitor(), 'activityNotes', '101')))
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

  describe('pushTokens', () => {
    it('lets only the owner register a device', async () => {
      await assertFails(setDoc(doc(visitor(), 'pushTokens', 'token-2'), { createdAt: 2 }))
      await assertFails(setDoc(doc(stranger(), 'pushTokens', 'token-2'), { createdAt: 2 }))
      await assertSucceeds(setDoc(doc(owner(), 'pushTokens', 'token-2'), { createdAt: 2 }))
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
