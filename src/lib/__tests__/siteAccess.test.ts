import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SESSION_MAX_AGE_SEC,
  gateDecision,
  isPublicPath,
  isSitePrivate,
  mayView,
  publicRealDataError,
  returnPath,
  sessionKey,
  sessionSecret,
  signSession,
  verifiedEmail,
  verifySession,
  viewerEmails,
} from '../siteAccess'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const KEY = { secret: SECRET, audience: 'runomics-owner' }
const NOW = Date.parse('2026-10-07T12:00:00Z')
const OWNER = { sub: 'uid-owner', owner: true, email: 'adam@example.com' }
const VIEWER = { sub: 'uid-viewer', owner: false, email: 'lamiaa@example.com' }

const PRIVATE = { RUNOMICS_PRIVATE: '1', SESSION_SECRET: SECRET, FIREBASE_PROJECT_ID: 'runomics-owner', RUNOMICS_VIEWERS: 'Lamiaa@Example.com' }

describe('the private-site settings', () => {
  it('is off unless RUNOMICS_PRIVATE says 1 or true', () => {
    expect(isSitePrivate({})).toBe(false)
    expect(isSitePrivate({ RUNOMICS_PRIVATE: '0' })).toBe(false)
    expect(isSitePrivate({ RUNOMICS_PRIVATE: 'yes please' })).toBe(false)
    expect(isSitePrivate({ RUNOMICS_PRIVATE: '1' })).toBe(true)
    expect(isSitePrivate({ RUNOMICS_PRIVATE: ' TRUE ' })).toBe(true)
  })

  it('takes no short secret: a placeholder is not a key', () => {
    expect(sessionSecret({})).toBeNull()
    expect(sessionSecret({ SESSION_SECRET: 'changeme' })).toBeNull()
    expect(sessionSecret({ SESSION_SECRET: SECRET })).toBe(SECRET)
  })

  it('signs only with a usable secret and the deployment’s Firebase project', () => {
    expect(sessionKey({ SESSION_SECRET: SECRET, FIREBASE_PROJECT_ID: ' runomics-owner ' })).toEqual(KEY)
    expect(sessionKey({ SESSION_SECRET: SECRET })).toBeNull()
    expect(sessionKey({ SESSION_SECRET: SECRET, FIREBASE_PROJECT_ID: ' ' })).toBeNull()
    expect(sessionKey({ SESSION_SECRET: 'short', FIREBASE_PROJECT_ID: 'runomics-owner' })).toBeNull()
  })

  it('reads the invited list with commas or spaces, in any case', () => {
    expect(viewerEmails({})).toEqual([])
    expect(viewerEmails({ RUNOMICS_VIEWERS: ' A@x.com, b@Y.com  c@z.com;' })).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
  })

  it('leaves the way in and the workflow routes open, and nothing else', () => {
    expect(isPublicPath('/sign-in')).toBe(true)
    expect(isPublicPath('/api/session')).toBe(true)
    expect(isPublicPath('/api/internal/pr-check')).toBe(true)
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/sign-in-elsewhere')).toBe(false)
    expect(isPublicPath('/api/internal')).toBe(false)
    expect(isPublicPath('/api/activities/export')).toBe(false)
  })
})

describe('the build’s privacy check', () => {
  const REAL_ON_VERCEL = { VERCEL: '1', RUNOMICS_DATA_REPO_URL: 'https://github.com/owner/data' }

  it('fails a Vercel build of real data that is not private with a usable secret', () => {
    expect(publicRealDataError(REAL_ON_VERCEL)).toMatch(/RUNOMICS_PRIVATE=1 and SESSION_SECRET/)
    expect(publicRealDataError({ ...REAL_ON_VERCEL, RUNOMICS_PRIVATE: '1', SESSION_SECRET: 'changeme' })).toMatch(
      /SESSION_SECRET \(32\+ characters\)/
    )
    expect(publicRealDataError({ ...REAL_ON_VERCEL, SESSION_SECRET: SECRET })).toMatch(/RUNOMICS_PRIVATE=1:/)
  })

  it('passes a private Vercel build, the demo, and a local build', () => {
    expect(publicRealDataError({ ...REAL_ON_VERCEL, ...PRIVATE })).toBeNull()
    expect(publicRealDataError({ VERCEL: '1' })).toBeNull()
    expect(publicRealDataError({ RUNOMICS_DATA_REPO_URL: 'https://github.com/owner/data' })).toBeNull()
  })
})

describe('who may view', () => {
  it('is the owner, or a verified email on the list', () => {
    expect(mayView({ owner: true, email: null }, [])).toBe(true)
    expect(mayView({ owner: false, email: 'lamiaa@example.com' }, ['lamiaa@example.com'])).toBe(true)
    expect(mayView({ owner: false, email: 'someone@example.com' }, ['lamiaa@example.com'])).toBe(false)
    expect(mayView({ owner: false, email: null }, ['lamiaa@example.com'])).toBe(false)
  })

  // Anyone can create a Firebase account claiming any address; Google's verification is the proof.
  it('takes an email only when Google verified it', () => {
    expect(verifiedEmail({ email: 'Lamiaa@Example.com', email_verified: true })).toBe('lamiaa@example.com')
    expect(verifiedEmail({ email: 'lamiaa@example.com', email_verified: false })).toBeNull()
    expect(verifiedEmail({ email: 'lamiaa@example.com' })).toBeNull()
  })
})

describe('the session cookie', () => {
  it('carries who it is for, for a month', () => {
    const session = verifySession(signSession(OWNER, KEY, NOW), KEY, NOW + 1000)
    expect(session).toMatchObject({ ...OWNER, aud: 'runomics-owner', iat: NOW / 1000, exp: NOW / 1000 + SESSION_MAX_AGE_SEC })
    expect(verifySession(signSession(OWNER, KEY, NOW), KEY, NOW + SESSION_MAX_AGE_SEC * 1000)).toBeNull()
  })

  it('opens only the deployment that signed it, even under the same secret', () => {
    const fromTheOtherSite = signSession(OWNER, { secret: SECRET, audience: 'runomics-second' }, NOW)
    expect(verifySession(fromTheOtherSite, KEY, NOW)).toBeNull()
  })

  it('refuses a cookie of the old format, which named no deployment', () => {
    const body = `v1.${Buffer.from(JSON.stringify({ ...OWNER, iat: NOW / 1000, exp: NOW / 1000 + 60 })).toString('base64url')}`
    const mac = createHmac('sha256', SECRET).update(body).digest('base64url')
    expect(verifySession(`${body}.${mac}`, KEY, NOW)).toBeNull()
  })

  it('is refused when signed with another secret, edited, or not a session at all', () => {
    const token = signSession(VIEWER, KEY, NOW)
    expect(verifySession(token, { ...KEY, secret: `${SECRET}-rotated` }, NOW)).toBeNull()

    const [version, , mac] = token.split('.')
    const promoted = Buffer.from(JSON.stringify({ ...VIEWER, owner: true, aud: KEY.audience, iat: NOW / 1000, exp: NOW / 1000 + 60 })).toString('base64url')
    expect(verifySession(`${version}.${promoted}.${mac}`, KEY, NOW)).toBeNull()

    expect(verifySession(undefined, KEY, NOW)).toBeNull()
    expect(verifySession('', KEY, NOW)).toBeNull()
    expect(verifySession('v2.e30', KEY, NOW)).toBeNull()
    expect(verifySession(`${token}.extra`, KEY, NOW)).toBeNull()
  })

  it('is refused when it claims to be issued later than now', () => {
    expect(verifySession(signSession(OWNER, KEY, NOW + 30_000), KEY, NOW)).not.toBeNull()
    expect(verifySession(signSession(OWNER, KEY, NOW + 3600_000), KEY, NOW)).toBeNull()
  })
})

describe('the gate', () => {
  const decide = (pathname: string, cookie: string | undefined, env: Record<string, string | undefined> = PRIVATE) =>
    gateDecision({ pathname, cookie, env, nowMs: NOW })

  it('lets everything through on a public site', () => {
    expect(decide('/', undefined, {})).toBe('pass')
    expect(decide('/api/map/routes', undefined, { SESSION_SECRET: SECRET })).toBe('pass')
  })

  it('sends a page to sign-in and answers an API with a 401, without a session', () => {
    expect(decide('/', undefined)).toBe('signIn')
    expect(decide('/activities/123', 'garbage')).toBe('signIn')
    expect(decide('/api/map/routes', undefined)).toBe('unauthorized')
    expect(decide('/api', undefined)).toBe('unauthorized')
  })

  it('keeps the way in open', () => {
    expect(decide('/sign-in', undefined)).toBe('pass')
    expect(decide('/api/session', undefined)).toBe('pass')
    expect(decide('/api/internal/ai-insights', undefined)).toBe('pass')
  })

  it('lets the owner and an invited viewer in', () => {
    expect(decide('/', signSession(OWNER, KEY, NOW))).toBe('pass')
    expect(decide('/api/map/routes', signSession(VIEWER, KEY, NOW))).toBe('pass')
  })

  it('closes a viewer’s session once their email leaves the list', () => {
    const cookie = signSession(VIEWER, KEY, NOW)
    expect(decide('/', cookie, { ...PRIVATE, RUNOMICS_VIEWERS: '' })).toBe('signIn')
    // The owner needs no list.
    expect(decide('/', signSession(OWNER, KEY, NOW), { ...PRIVATE, RUNOMICS_VIEWERS: '' })).toBe('pass')
  })

  // A gate that opened on a missing env var would not be one.
  it('lets nobody in when private without a usable secret or a Firebase project', () => {
    const cookie = signSession(OWNER, KEY, NOW)
    expect(decide('/', cookie, { RUNOMICS_PRIVATE: '1', FIREBASE_PROJECT_ID: 'runomics-owner' })).toBe('signIn')
    expect(decide('/', cookie, { RUNOMICS_PRIVATE: '1', SESSION_SECRET: 'short', FIREBASE_PROJECT_ID: 'runomics-owner' })).toBe('signIn')
    expect(decide('/', cookie, { RUNOMICS_PRIVATE: '1', SESSION_SECRET: SECRET })).toBe('signIn')
  })

  it('turns away the other athlete’s owner cookie, though both sites share a secret', () => {
    const cookie = signSession(OWNER, { secret: SECRET, audience: 'runomics-second' }, NOW)
    expect(decide('/', cookie)).toBe('signIn')
    expect(decide('/api/map/routes', cookie)).toBe('unauthorized')
  })
})

describe('the way back after signing in', () => {
  it('is the page and its query, less the router’s own', () => {
    expect(returnPath(new URL('https://run.example/plan?view=month&_rsc=abc'))).toBe('/plan?view=month')
    expect(returnPath(new URL('https://run.example/?_rsc=abc'))).toBe('/')
    expect(returnPath(new URL('https://run.example/activities/42'))).toBe('/activities/42')
  })
})
