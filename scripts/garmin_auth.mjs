#!/usr/bin/env node
// The OAuth1 token in GARMIN_SECRET carries no expiry, so all this can prove is that a refresh still works today.
import { spawn } from 'child_process'

const PYTHON = process.env.RUNOMICS_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3')

function ask() {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ['scripts/garmin/sync_bridge.py'], { stdio: ['pipe', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.on('error', reject)
    child.on('close', () => {
      const line = out.split('\n').find(Boolean)
      if (!line) return reject(new Error('the Garmin bridge said nothing'))
      resolve(JSON.parse(line))
    })
    child.stdin.write(JSON.stringify({ op: 'auth' }) + '\n')
    child.stdin.end()
  })
}

const days = (iso) => Math.round((Date.parse(iso) - Date.now()) / 86_400_000)

const answer = await ask()
if (!answer.ok) {
  console.error(`\nGarmin credentials: NOT USABLE\n\n${answer.error}\n`)
  process.exit(1)
}

const { oauth1, oauth2 } = answer
console.log('\nGarmin credentials\n')
console.log(`  OAuth1 (the long-lived one, from GARMIN_SECRET)`)
console.log(`     present : ${oauth1.present ? 'yes' : 'NO'}`)
console.log(`     expiry  : not recorded - ${oauth1.note}`)
console.log(`\n  OAuth2 (minted from it on every run)`)
console.log(`     access token expires  : ${oauth2.expiresAt ?? 'unknown'}${oauth2.expired ? '  (expired, refreshed on use)' : ''}`)
if (oauth2.refreshTokenExpiresAt) {
  // Labelled so nobody reads it as a deadline: refresh_oauth2() re-exchanges the OAuth1 token every time.
  const left = days(oauth2.refreshTokenExpiresAt)
  console.log(`     refresh token expires : ${oauth2.refreshTokenExpiresAt}  (${left} days, unused)`)
  console.log(`                             every run re-exchanges the OAuth1 token instead,`)
  console.log(`                             so this date has no bearing on the sync`)
}

console.log(`\n  A token exchange succeeded just now, so the credentials work today.`)
console.log(`  They will keep working until Garmin expires the OAuth1 token, which`)
console.log(`  is not something this command - or garth - can see in advance.\n`)
console.log(`  When it does expire the sync stops, and scripts/get_secret.py cannot`)
console.log(`  mint a replacement: Garmin's March 2026 auth change is what broke it.`)
console.log(`  See "Optional: the garth token" under Setup in README.md.\n`)
