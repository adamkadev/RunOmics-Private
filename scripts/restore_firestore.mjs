#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isGearId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)

/** Each backup the nightly sync commits, the key holding its documents, and the shape firestore.rules accepts. */
export const COLLECTIONS = [
  {
    name: 'activityNotes',
    file: 'activity_notes.json',
    key: 'notes',
    valid: (_id, doc) =>
      typeof doc.note === 'string' && doc.note.length <= 500 && Array.isArray(doc.tags) && doc.tags.length <= 10 &&
      doc.tags.every((tag) => typeof tag === 'string'),
  },
  {
    name: 'wellness',
    file: 'wellness.json',
    key: 'entries',
    valid: (id, doc) => DATE.test(id) && Object.keys(doc).length > 0,
  },
  {
    name: 'routeNames',
    file: 'route_names.json',
    key: 'names',
    valid: (_id, doc) => typeof doc.name === 'string' && doc.name.trim().length > 0 && doc.name.length <= 80,
  },
  {
    name: 'avoidSpots',
    file: 'avoid_spots.json',
    key: 'spots',
    valid: (_id, doc) =>
      isFiniteNumber(doc.lon) && isFiniteNumber(doc.lat) && Math.abs(doc.lon) <= 180 && Math.abs(doc.lat) <= 90 &&
      Number.isInteger(doc.radiusM) && doc.radiusM >= 20 && doc.radiusM <= 250 && typeof doc.createdAt === 'string' &&
      (doc.expiresOn === undefined || (typeof doc.expiresOn === 'string' && DATE.test(doc.expiresOn))),
  },
  {
    name: 'runShoes',
    file: 'shoe_choices.json',
    key: 'runs',
    valid: (_id, doc) => isGearId(doc.gearId),
  },
  {
    name: 'shoeSettings',
    file: 'shoe_choices.json',
    key: 'settings',
    valid: (id, doc) => id === 'default' && isGearId(doc.gearId),
  },
  {
    name: 'raceEntries',
    file: 'race_entries.json',
    key: 'races',
    valid: (_id, doc) =>
      (doc.removed === true && typeof doc.garminKey === 'string') ||
      (typeof doc.name === 'string' && doc.name.length > 0 && doc.name.length <= 80 && DATE.test(doc.date) &&
        isFiniteNumber(doc.distanceKm) && doc.distanceKm >= 1 && doc.distanceKm <= 250 && ['A', 'B', 'C'].includes(doc.priority)),
  },
  {
    name: 'goalEntries',
    file: 'goal_entries.json',
    key: 'goals',
    valid: (id, doc) => /^20\d{2}$/.test(id) && (doc.removed === true || isObject(doc.targets)),
  },
]

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}

/** Null when the backup is missing; throws when it is there but unreadable, so a broken file is never taken for an empty one. */
export function readBackup(dir, collection) {
  const file = path.join(dir, collection.file)
  if (!fs.existsSync(file)) return null
  const docs = JSON.parse(fs.readFileSync(file, 'utf8'))?.[collection.key]
  if (!isObject(docs)) throw new Error(`${collection.file}: no "${collection.key}" object`)
  return docs
}

/** Upserts only: a document Firestore has and the backup does not is left alone. */
export function planRestore(collection, backup, current) {
  const plan = { create: [], update: [], same: 0, invalid: 0 }
  for (const [id, doc] of Object.entries(backup)) {
    if (!isObject(doc) || !collection.valid(id, doc)) {
      plan.invalid++
      continue
    }
    const existing = current.get(id)
    if (existing === undefined) plan.create.push([id, doc])
    else if (canonical(existing) !== canonical(doc)) plan.update.push([id, doc])
    else plan.same++
  }
  return plan
}

/** Counts only: the documents are notes, health data and the places the athlete runs. */
export function describePlan(name, plan, apply) {
  const writes = plan.create.length + plan.update.length
  const verb = apply ? 'wrote' : 'would write'
  const invalid = plan.invalid ? `, ${plan.invalid} skipped as malformed` : ''
  return `${name}: ${verb} ${writes} (${plan.create.length} missing, ${plan.update.length} changed), ${plan.same} already as backed up${invalid}.`
}

function parseArgs(argv) {
  const args = { dir: 'data', apply: false }
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`)
    else args.dir = arg
  }
  return args
}

async function adminFirestore() {
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not set')
  const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId })
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
  return getFirestore(app)
}

/** Firestore takes at most 500 writes in one batch. */
const BATCH = 400

async function main() {
  const { dir, apply } = parseArgs(process.argv.slice(2))
  const db = await adminFirestore()
  console.log(`${apply ? 'Restoring' : 'Dry run: nothing is written. Add --apply to restore'} from ${dir} to ${process.env.FIREBASE_PROJECT_ID}.`)

  for (const collection of COLLECTIONS) {
    const backup = readBackup(dir, collection)
    if (!backup) {
      console.log(`${collection.name}: no ${collection.file}, skipped.`)
      continue
    }
    const snapshot = await db.collection(collection.name).get()
    const current = new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]))
    const plan = planRestore(collection, backup, current)
    if (apply) {
      const writes = [...plan.create, ...plan.update]
      for (let i = 0; i < writes.length; i += BATCH) {
        const batch = db.batch()
        for (const [id, doc] of writes.slice(i, i + BATCH)) batch.set(db.collection(collection.name).doc(id), doc)
        await batch.commit()
      }
    }
    console.log(describePlan(collection.name, plan, apply))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`restore_firestore: ${err.message}`)
    process.exit(1)
  })
}
