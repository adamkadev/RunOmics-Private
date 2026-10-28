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

if (answer.kind === 'garth') {
  const { oauth2 } = answer
  console.log('\nGarmin credentials: a garth token (legacy)\n')
  console.log(`  OAuth1 : present, expiry not recorded by garth or Garmin`)
  console.log(`  OAuth2 : access token expires ${oauth2.expiresAt ?? 'unknown'}${answer.refreshedNow ? ' (exchanged just now)' : ''}`)
  console.log(`\n  ${answer.refreshedNow ? 'An OAuth1 exchange succeeded just now, so it works today.' : 'The OAuth2 token was still valid, so no exchange was tried: this proves nothing about the OAuth1 token.'}`)
  console.log(`  garth tokens cannot be renewed. Mint a garminconnect token with`)
  console.log(`  python scripts/get_secret.py and replace GARMIN_SECRET with it.`)
  console.log(README)
  process.exit(0)
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
