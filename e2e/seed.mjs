// Seeds the e2e Firestore fixtures (goals/pbs/athlete) into whatever project
// the FIREBASE_* Admin env vars point to. Separate from scripts/seed_firestore.js
// (which reads public/*.json - the real, uncommitted prod data) so running e2e
// tests can never touch prod data even by mistake: this script only ever reads
// from e2e/fixtures/, which is version-controlled and non-secret.
//
// Idempotent (Firestore .set() upserts by fixed doc id), so it's safe to run
// on every CI job and every local run.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

const db = getFirestore(app)
const fixturesDir = path.join(__dirname, 'fixtures')

async function seed() {
  const goals = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'goals.json'), 'utf-8'))
  for (const goal of goals) {
    await db.collection('goals').doc(String(goal.year)).set(goal)
  }

  const pbs = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'pbs.json'), 'utf-8'))
  for (const pbYear of pbs) {
    await db.collection('pbs').doc(String(pbYear.year)).set(pbYear)
  }

  const athlete = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'athlete.json'), 'utf-8'))
  await db.collection('athlete').doc('profile').set(athlete)

  console.log(`e2e fixtures seeded into Firestore project "${process.env.FIREBASE_PROJECT_ID}".`)
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
