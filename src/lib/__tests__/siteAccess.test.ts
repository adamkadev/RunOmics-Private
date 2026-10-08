import { describe, expect, it } from 'vitest'
import {
  SESSION_MAX_AGE_SEC,
  gateDecision,
  isPublicPath,
  isSitePrivate,
  mayView,
  returnPath,
  sessionSecret,
  signSession,
  verifiedEmail,
  verifySession,
  viewerEmails,
} from '../siteAccess'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const NOW = Date.parse('2026-10-07T12:00:00Z')
const OWNER = { sub: 'uid-owner', owner: true, email: 'adam@example.com' }
const VIEWER = { sub: 'uid-viewer', owner: false, email: 'lamiaa@example.com' }

const PRIVATE = { RUNOMICS_PRIVATE: '1', SESSION_SECRET: SECRET, RUNOMICS_VIEWERS: 'Lamiaa@Example.com' }

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
    const session = verifySession(signSession(OWNER, SECRET, NOW), SECRET, NOW + 1000)
    expect(session).toMatchObject({ ...OWNER, iat: NOW / 1000, exp: NOW / 1000 + SESSION_MAX_AGE_SEC })
    expect(verifySession(signSession(OWNER, SECRET, NOW), SECRET, NOW + SESSION_MAX_AGE_SEC * 1000)).toBeNull()
  })

  it('is refused when signed with another secret, edited, or not a session at all', () => {
    const token = signSession(VIEWER, SECRET, NOW)
    expect(verifySession(token, `${SECRET}-rotated`, NOW)).toBeNull()

    const [version, , mac] = token.split('.')
    const promoted = Buffer.from(JSON.stringify({ ...VIEWER, owner: true, iat: NOW / 1000, exp: NOW / 1000 + 60 })).toString('base64url')
    expect(verifySession(`${version}.${promoted}.${mac}`, SECRET, NOW)).toBeNull()

    expect(verifySession(undefined, SECRET, NOW)).toBeNull()
    expect(verifySession('', SECRET, NOW)).toBeNull()
    expect(verifySession('v1.e30', SECRET, NOW)).toBeNull()
    expect(verifySession(`${token}.extra`, SECRET, NOW)).toBeNull()
  })

  it('is refused when it claims to be issued later than now', () => {
    expect(verifySession(signSession(OWNER, SECRET, NOW + 30_000), SECRET, NOW)).not.toBeNull()
    expect(verifySession(signSession(OWNER, SECRET, NOW + 3600_000), SECRET, NOW)).toBeNull()
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
    expect(decide('/', signSession(OWNER, SECRET, NOW))).toBe('pass')
    expect(decide('/api/map/routes', signSession(VIEWER, SECRET, NOW))).toBe('pass')
  })

  it('closes a viewer’s session once their email leaves the list', () => {
    const cookie = signSession(VIEWER, SECRET, NOW)
    expect(decide('/', cookie, { ...PRIVATE, RUNOMICS_VIEWERS: '' })).toBe('signIn')
    // The owner needs no list.
    expect(decide('/', signSession(OWNER, SECRET, NOW), { ...PRIVATE, RUNOMICS_VIEWERS: '' })).toBe('pass')
  })

  // A gate that opened on a missing env var would not be one.
  it('lets nobody in when private without a usable secret', () => {
    const cookie = signSession(OWNER, SECRET, NOW)
    expect(decide('/', cookie, { RUNOMICS_PRIVATE: '1' })).toBe('signIn')
    expect(decide('/', cookie, { RUNOMICS_PRIVATE: '1', SESSION_SECRET: 'short' })).toBe('signIn')
  })
})

describe('the way back after signing in', () => {
  it('is the page and its query, less the router’s own', () => {
    expect(returnPath(new URL('https://run.example/plan?view=month&_rsc=abc'))).toBe('/plan?view=month')
    expect(returnPath(new URL('https://run.example/?_rsc=abc'))).toBe('/')
    expect(returnPath(new URL('https://run.example/activities/42'))).toBe('/activities/42')
  })
})
