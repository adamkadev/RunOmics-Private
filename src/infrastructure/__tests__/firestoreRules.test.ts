import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

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
      await setDoc(doc(db, 'runShoes', '101'), { gearId: 'shoe1' })
      await setDoc(doc(db, 'shoeSettings', 'default'), { gearId: 'shoe1' })
      await setDoc(doc(db, 'avoidSpots', 'spot-1'), { lon: -150, lat: 0, radiusM: 80, createdAt: '2026-10-25' })
      await setDoc(doc(db, 'wellness', '2026-10-24'), { sleep: 2, soreness: 4, ill: true })
      await setDoc(doc(db, 'pushTokens', 'token-1'), { token: 'token-1', userAgent: 'iPhone' })
      await setDoc(doc(db, 'aiInsights', 'today'), { text: 'x' })
      await setDoc(doc(db, 'raceEntries', 'race-1'), { name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'A' })
      await setDoc(doc(db, 'goalEntries', '2027'), { annualDistanceKm: 1500, targets: { '10k': 2700 } })
      await setDoc(doc(db, 'jobEvents', 'event-1'), { at: '2026-10-27T06:00:01.000Z', route: 'daily-session', trigger: 'cron', outcome: 'sent', status: 200 })
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
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: '', tags: [], hrUnreliable: false }))
      await assertFails(setDoc(doc(db, 'activityNotes', '103'), { note: '', tags: [], hrUnreliable: 'yes' }))
    })

    it('lets the owner mark a run\'s heart rate unreliable', async () => {
      await assertSucceeds(setDoc(doc(owner(), 'activityNotes', '104'), { note: '', tags: [], hrUnreliable: true }))
      await assertFails(setDoc(doc(visitor(), 'activityNotes', '105'), { note: '', tags: [], hrUnreliable: true }))
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

  describe('runShoes', () => {
    it('lets only the owner read and list the picks', async () => {
      await assertFails(getDoc(doc(visitor(), 'runShoes', '101')))
      await assertFails(getDoc(doc(stranger(), 'runShoes', '101')))
      await assertFails(getDocs(collection(stranger(), 'runShoes')))
      await assertSucceeds(getDoc(doc(owner(), 'runShoes', '101')))
      await assertSucceeds(getDocs(collection(owner(), 'runShoes')))
    })

    it('only lets the owner pick a shoe, and only by a well-formed gear id', async () => {
      await assertFails(setDoc(doc(visitor(), 'runShoes', '102'), { gearId: 'shoe2' }))
      await assertFails(setDoc(doc(stranger(), 'runShoes', '102'), { gearId: 'shoe2' }))
      await assertSucceeds(setDoc(doc(owner(), 'runShoes', '102'), { gearId: 'shoe2' }))

      const db = owner()
      await assertFails(setDoc(doc(db, 'runShoes', '103'), { gearId: '' }))
      await assertFails(setDoc(doc(db, 'runShoes', '103'), { gearId: 'x'.repeat(65) }))
      await assertFails(setDoc(doc(db, 'runShoes', '103'), { gearId: 'shoe/2' }))
      await assertFails(setDoc(doc(db, 'runShoes', '103'), { gearId: 7 }))
      await assertFails(setDoc(doc(db, 'runShoes', '103'), { gearId: 'shoe2', km: 10 }))
    })

    it('only lets the owner clear a pick', async () => {
      await assertFails(deleteDoc(doc(stranger(), 'runShoes', '101')))
      await assertSucceeds(deleteDoc(doc(owner(), 'runShoes', '101')))
    })
  })

  describe('shoeSettings', () => {
    it('lets only the owner read the default shoe', async () => {
      await assertFails(getDoc(doc(visitor(), 'shoeSettings', 'default')))
      await assertFails(getDoc(doc(stranger(), 'shoeSettings', 'default')))
      await assertSucceeds(getDoc(doc(owner(), 'shoeSettings', 'default')))
    })

    it('only lets the owner set it, under the one id the app uses', async () => {
      await assertFails(setDoc(doc(stranger(), 'shoeSettings', 'default'), { gearId: 'shoe2' }))
      await assertSucceeds(setDoc(doc(owner(), 'shoeSettings', 'default'), { gearId: 'shoe2' }))
      await assertFails(setDoc(doc(owner(), 'shoeSettings', 'other'), { gearId: 'shoe2' }))
      await assertFails(setDoc(doc(owner(), 'shoeSettings', 'default'), { gearId: 'shoe 2' }))
    })

    it('only lets the owner clear it', async () => {
      await assertFails(deleteDoc(doc(stranger(), 'shoeSettings', 'default')))
      await assertSucceeds(deleteDoc(doc(owner(), 'shoeSettings', 'default')))
    })
  })

  describe('avoidSpots', () => {
    const spot = { lon: -150.01, lat: 0.01, radiusM: 80, createdAt: '2026-10-26', reason: 'blocked' }

    it('lets only the owner read and list them', async () => {
      await assertFails(getDoc(doc(visitor(), 'avoidSpots', 'spot-1')))
      await assertFails(getDocs(collection(stranger(), 'avoidSpots')))
      await assertSucceeds(getDoc(doc(owner(), 'avoidSpots', 'spot-1')))
      await assertSucceeds(getDocs(collection(owner(), 'avoidSpots')))
    })

    it('only lets the owner write, and only a well-formed spot', async () => {
      await assertFails(setDoc(doc(visitor(), 'avoidSpots', 'spot-2'), spot))
      await assertFails(setDoc(doc(stranger(), 'avoidSpots', 'spot-2'), spot))
      await assertSucceeds(setDoc(doc(owner(), 'avoidSpots', 'spot-2'), spot))

      const db = owner()
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, radiusM: 5000 }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, radiusM: 80.5 }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, lat: 91 }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, reason: 'free text' }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, createdAt: 'yesterday' }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { ...spot, note: 'x' }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-3'), { lon: -150, lat: 0, radiusM: 80 }))
    })

    it('takes an expiry date on a spot, and only a date', async () => {
      const db = owner()
      await assertSucceeds(setDoc(doc(db, 'avoidSpots', 'spot-4'), { ...spot, reason: 'mud', expiresOn: '2026-11-16' }))
      await assertSucceeds(updateDoc(doc(db, 'avoidSpots', 'spot-4'), { reason: 'unsafe', expiresOn: deleteField() }))
      await assertSucceeds(updateDoc(doc(db, 'avoidSpots', 'spot-4'), { radiusM: 150 }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-5'), { ...spot, expiresOn: 'in three weeks' }))
      await assertFails(setDoc(doc(db, 'avoidSpots', 'spot-5'), { ...spot, expiresOn: 20261116 }))
      await assertFails(setDoc(doc(stranger(), 'avoidSpots', 'spot-5'), { ...spot, expiresOn: '2026-11-16' }))
    })

    it('only lets the owner delete one', async () => {
      await assertFails(deleteDoc(doc(stranger(), 'avoidSpots', 'spot-1')))
      await assertSucceeds(deleteDoc(doc(owner(), 'avoidSpots', 'spot-1')))
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

    it('keeps a skipped session on its day, beside the check-in, the owner’s alone', async () => {
      await assertFails(setDoc(doc(visitor(), 'wellness', '2026-10-24'), { skipped: 'ill' }, { merge: true }))
      await assertFails(setDoc(doc(stranger(), 'wellness', '2026-10-24'), { skipped: 'ill' }, { merge: true }))
      await assertSucceeds(setDoc(doc(owner(), 'wellness', '2026-10-24'), { skipped: 'ill' }, { merge: true }))
      await assertSucceeds(setDoc(doc(owner(), 'wellness', '2026-10-26'), { skipped: 'life' }))
      await assertSucceeds(updateDoc(doc(owner(), 'wellness', '2026-10-24'), { skipped: deleteField() }))
      await assertSucceeds(getDocs(query(collection(owner(), 'wellness'), where('skipped', 'in', ['ill', 'rest', 'life']))))
      await assertFails(getDocs(query(collection(stranger(), 'wellness'), where('skipped', 'in', ['ill', 'rest', 'life']))))
    })

    it('takes only a known reason for a skip', async () => {
      await assertFails(setDoc(doc(owner(), 'wellness', '2026-10-25'), { skipped: 'tired' }))
      await assertFails(setDoc(doc(owner(), 'wellness', '2026-10-25'), { skipped: true }))
    })
  })

  describe('raceEntries', () => {
    const race = { name: 'Autumn Trail Half', date: '2027-05-29', distanceKm: 21.0975, priority: 'B', targetSeconds: 5400, location: 'Fictional Bay' }

    it('lets only the owner read the races', async () => {
      await assertFails(getDoc(doc(visitor(), 'raceEntries', 'race-1')))
      await assertFails(getDocs(collection(stranger(), 'raceEntries')))
      await assertSucceeds(getDoc(doc(owner(), 'raceEntries', 'race-1')))
      await assertSucceeds(getDocs(collection(owner(), 'raceEntries')))
    })

    it('lets only the owner add, edit and remove a race', async () => {
      await assertFails(setDoc(doc(visitor(), 'raceEntries', 'race-2'), race))
      await assertFails(setDoc(doc(stranger(), 'raceEntries', 'race-2'), race))
      await assertSucceeds(setDoc(doc(owner(), 'raceEntries', 'race-2'), race))
      await assertSucceeds(setDoc(doc(owner(), 'raceEntries', 'race-2'), { ...race, priority: 'C' }))
      await assertFails(deleteDoc(doc(stranger(), 'raceEntries', 'race-2')))
      await assertSucceeds(deleteDoc(doc(owner(), 'raceEntries', 'race-2')))
    })

    it('takes a just-finish race, an edit of a Garmin race and a Garmin race hidden', async () => {
      const finish = { name: race.name, date: race.date, distanceKm: race.distanceKm, priority: race.priority }
      await assertSucceeds(setDoc(doc(owner(), 'raceEntries', 'race-3'), finish))
      await assertSucceeds(setDoc(doc(owner(), 'raceEntries', 'garmin-uuid-1'), { ...race, garminKey: 'uuid-1' }))
      await assertSucceeds(setDoc(doc(owner(), 'raceEntries', 'garmin-uuid-2'), { garminKey: 'uuid-2', removed: true }))
    })

    it('rejects a race the editor would never send', async () => {
      const db = owner()
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, name: '' }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, name: 'x'.repeat(81) }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, date: '29/05/2027' }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, distanceKm: 0.5 }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, distanceKm: 300 }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, priority: 'D' }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, targetSeconds: 5400.5 }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, targetSeconds: 60 }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { ...race, notes: 'x' }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { removed: true }))
      await assertFails(setDoc(doc(db, 'raceEntries', 'race-4'), { garminKey: 'uuid-3', removed: false }))
    })
  })

  describe('goalEntries', () => {
    const goal = { annualDistanceKm: 1200, targets: { '5k': 1170, half: 5400, marathon: null } }

    it('lets only the owner read and write a season', async () => {
      await assertFails(getDoc(doc(visitor(), 'goalEntries', '2027')))
      await assertFails(getDocs(collection(stranger(), 'goalEntries')))
      await assertSucceeds(getDocs(collection(owner(), 'goalEntries')))
      await assertFails(setDoc(doc(stranger(), 'goalEntries', '2028'), goal))
      await assertSucceeds(setDoc(doc(owner(), 'goalEntries', '2028'), goal))
      await assertSucceeds(setDoc(doc(owner(), 'goalEntries', '2028'), { targets: {} }))
      await assertSucceeds(setDoc(doc(owner(), 'goalEntries', '2026'), { removed: true }))
      await assertSucceeds(deleteDoc(doc(owner(), 'goalEntries', '2028')))
    })

    it('rejects a season the editor would never send', async () => {
      const db = owner()
      await assertFails(setDoc(doc(db, 'goalEntries', 'next'), goal))
      await assertFails(setDoc(doc(db, 'goalEntries', '1999'), goal))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { annualDistanceKm: 1200 }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, annualDistanceKm: 0 }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, annualDistanceKm: 20000 }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, targets: { '15k': 3600 } }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, targets: { '5k': '19:30' } }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, targets: { '5k': 30 } }))
      await assertFails(setDoc(doc(db, 'goalEntries', '2028'), { ...goal, removed: true }))
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

  describe('jobEvents', () => {
    const event = { at: '2026-10-27T07:00:01.000Z', route: 'daily-session', trigger: 'cron', outcome: 'error', status: 500, error: 'TypeError' }

    it('lets only the owner read the runs', async () => {
      await assertFails(getDoc(doc(visitor(), 'jobEvents', 'event-1')))
      await assertFails(getDoc(doc(stranger(), 'jobEvents', 'event-1')))
      await assertFails(getDocs(collection(stranger(), 'jobEvents')))
      await assertSucceeds(getDoc(doc(owner(), 'jobEvents', 'event-1')))
      await assertSucceeds(getDocs(collection(owner(), 'jobEvents')))
    })

    it('lets no client write a run, owner included', async () => {
      await assertFails(setDoc(doc(visitor(), 'jobEvents', 'event-2'), event))
      await assertFails(setDoc(doc(owner(), 'jobEvents', 'event-2'), event))
      await assertFails(setDoc(doc(owner(), 'jobEvents', 'event-1'), event))
      await assertFails(deleteDoc(doc(owner(), 'jobEvents', 'event-1')))
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
