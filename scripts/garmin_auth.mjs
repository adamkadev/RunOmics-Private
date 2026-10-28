#!/usr/bin/env node
// Reports what GARMIN_SECRET's tokens say about themselves; a refresh is proved only when this run needed one.
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
const README = '  See "Optional: the Garmin Connect token" under Setup in README.md.\n'

const answer = await ask()
if (!answer.ok) {
  console.error(`\nGarmin credentials: NOT USABLE\n\n${answer.error}\n`)
  process.exit(1)
}

const { access, refresh } = answer
console.log('\nGarmin credentials: a garminconnect token\n')
console.log(`  access token  : expires ${access.expiresAt ?? 'unknown'}${answer.refreshedNow ? '  (refreshed just now)' : ''}`)
const refreshEnd = refresh.expiresAt ? `expires ${refresh.expiresAt} (${days(refresh.expiresAt)} days)` : 'expiry not readable from the token'
console.log(`  refresh token : ${refresh.present ? `present, ${refreshEnd}` : 'MISSING'}`)
console.log('')
if (!refresh.present) {
  console.log('  Without a refresh token the secret stops when the access token expires.')
} else if (answer.refreshedNow) {
  console.log('  A refresh succeeded just now, so the refresh token works today.')
} else {
  console.log('  The access token was still valid, so no refresh was tried: the refresh')
  console.log('  token is present but not proved until the access token next expires.')
}
if (answer.refreshTokenRotated) {
  console.log(answer.writeBack
    ? '  Garmin issued a new refresh token; it was written to GARMIN_SECRET_WRITEBACK.'
    : '  Garmin issued a new refresh token that nothing stored: set GARMIN_SECRET_WRITEBACK.')
}
console.log('  When Garmin refuses the refresh token, the sync reports Connect expired and')
console.log('  carries on with the Personal API; python scripts/get_secret.py mints a new one.')
console.log(README)
