import { createHmac, timingSafeEqual } from 'node:crypto'
import { SESSION_PATH, SIGN_IN_PATH } from '@/lib/siteSession'

/**
 * The private site (Oct 2026): with RUNOMICS_PRIVATE set, every page and API
 * answers only to the owner or an invited viewer, and everyone else is sent to
 * /sign-in. Off unless set, so a demo clone stays a public demo.
 *
 * A navigation carries no Firebase ID token, and checking one on every
 * request would cost an RSA verification and, now and then, a certificate
 * fetch. So /api/session checks the token once and answers with this
 * cookie - who, whether owner, until when - signed with SESSION_SECRET. The
 * proxy only checks the signature. Read by src/proxy.ts on the Node runtime:
 * node:crypto, and no 'server-only', which the proxy's bundle may not resolve.
 */

export const SESSION_COOKIE = 'runomics_session'

/**
 * A month. Past it, /sign-in checks the Google account again - without a tap
 * while Firebase still holds it - so a revoked account is out within the month.
 */
export const SESSION_MAX_AGE_SEC = 30 * 24 * 3600

/** Shorter than this, SESSION_SECRET is a placeholder or a typo, not a key. */
export const MIN_SECRET_LENGTH = 32

/** Seconds a signing server's clock may run ahead of the one checking. */
const CLOCK_SKEW_SEC = 60

type Env = Record<string, string | undefined>

export function isSitePrivate(env: Env): boolean {
  const flag = env.RUNOMICS_PRIVATE?.trim().toLowerCase()
  return flag === '1' || flag === 'true'
}

export function sessionSecret(env: Env): string | null {
  const secret = env.SESSION_SECRET?.trim()
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null
}

/** The Google accounts invited to view, from RUNOMICS_VIEWERS: commas or spaces between, any case. */
export function viewerEmails(env: Env): string[] {
  return (env.RUNOMICS_VIEWERS ?? '')
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * What a visitor without a session may still reach: the way in, and the
 * workflow's routes, which carry their own shared secret (internalAuth).
 */
export function isPublicPath(pathname: string): boolean {
  return pathname === SIGN_IN_PATH || pathname === SESSION_PATH || pathname.startsWith('/api/internal/')
}

/** Who a session is for. The email is set only when Google verified it. */
export interface SiteViewer {
  owner: boolean
  email: string | null
}

/** The owner claim, or a verified email on the invited list. */
export function mayView(viewer: SiteViewer, viewers: readonly string[]): boolean {
  return viewer.owner || (viewer.email !== null && viewers.includes(viewer.email.toLowerCase()))
}

/** A Firebase token's email, lower-cased, only when Google verified it: anyone can type an unverified one. */
export function verifiedEmail(claims: { email?: unknown; email_verified?: unknown }): string | null {
  return claims.email_verified === true && typeof claims.email === 'string' ? claims.email.toLowerCase() : null
}

export interface SiteSession extends SiteViewer {
  /** The Firebase uid. */
  sub: string
  /** Seconds since the epoch. */
  iat: number
  exp: number
}

const TOKEN_VERSION = 'v1'

function signature(body: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(body).digest()
}

export function signSession(who: SiteViewer & { sub: string }, secret: string, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000)
  const session: SiteSession = { sub: who.sub, owner: who.owner, email: who.email, iat, exp: iat + SESSION_MAX_AGE_SEC }
  const body = `${TOKEN_VERSION}.${Buffer.from(JSON.stringify(session)).toString('base64url')}`
  return `${body}.${signature(body, secret).toString('base64url')}`
}

function isSession(value: unknown): value is SiteSession {
  const session = value as Partial<SiteSession> | null
  return (
    typeof session === 'object' &&
    session !== null &&
    typeof session.sub === 'string' &&
    typeof session.owner === 'boolean' &&
    (session.email === null || typeof session.email === 'string') &&
    typeof session.iat === 'number' &&
    typeof session.exp === 'number'
  )
}

/** The session a cookie carries, or null for anything not signed with this secret, malformed or expired. */
export function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): SiteSession | null {
  const [version, payload, mac, ...rest] = token?.split('.') ?? []
  if (version !== TOKEN_VERSION || !payload || !mac || rest.length) return null

  const given = Buffer.from(mac, 'base64url')
  const expected = signature(`${version}.${payload}`, secret)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  let session: unknown
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!isSession(session)) return null

  const now = nowMs / 1000
  if (session.exp <= now || session.iat > now + CLOCK_SKEW_SEC) return null
  return session
}

export type GateDecision = 'pass' | 'signIn' | 'unauthorized'

/**
 * What the proxy does with a request. The invited list is read again on each
 * one, so taking an email off it closes that session at the next deploy. A
 * private site without a usable secret lets nobody in: the owner turned
 * privacy on, and a gate that opens on a missing env var is not one.
 */
export function gateDecision({ pathname, cookie, env, nowMs = Date.now() }: { pathname: string; cookie: string | undefined; env: Env; nowMs?: number }): GateDecision {
  if (!isSitePrivate(env) || isPublicPath(pathname)) return 'pass'

  const secret = sessionSecret(env)
  const session = secret ? verifySession(cookie, secret, nowMs) : null
  if (session && mayView(session, viewerEmails(env))) return 'pass'

  return pathname === '/api' || pathname.startsWith('/api/') ? 'unauthorized' : 'signIn'
}

/** The page to come back to after signing in: where the reader was, less the router's own query. */
export function returnPath(url: URL): string {
  const search = new URLSearchParams(url.search)
  search.delete('_rsc')
  const query = search.toString()
  return `${url.pathname}${query ? `?${query}` : ''}`
}
