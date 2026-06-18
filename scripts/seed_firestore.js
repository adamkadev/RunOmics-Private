const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const fs = require('fs')
const path = require('path')

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

const db = getFirestore(app)

async function seed() {
  const publicDir = path.join(__dirname, '..', 'public')

  // goals
  const goals = JSON.parse(fs.readFileSync(path.join(publicDir, 'goals.json'), 'utf-8'))
  for (const goal of goals) {
    await db.collection('goals').doc(String(goal.year)).set(goal)
    console.log(`goals/${goal.year} written`)
  }

  // pbs
  const pbs = JSON.parse(fs.readFileSync(path.join(publicDir, 'pbs.json'), 'utf-8'))
  for (const pbYear of pbs) {
    await db.collection('pbs').doc(String(pbYear.year)).set(pbYear)
    console.log(`pbs/${pbYear.year} written`)
  }

  // athlete
  const athlete = JSON.parse(fs.readFileSync(path.join(publicDir, 'athlete.json'), 'utf-8'))
  await db.collection('athlete').doc('profile').set(athlete)
  console.log('athlete/profile written')

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
