import 'server-only'
import jwt from 'jsonwebtoken'

/**
 * Verifies a Firebase ID token without going through firebase-admin/auth.
 *
 * firebase-admin/auth pulls in jwks-rsa, which in its current release requires
 * jose - a pure-ESM package - with a plain CJS require(). That throws
 * ERR_REQUIRE_ESM on any Node runtime whose require() doesn't understand ESM
 * (most of them), independent of bundling: the crash happens inside jwks-rsa's
 * own unbundled source in node_modules, not in anything Next.js generates. It
 * broke this route in production the first time anything imported
 * firebase-admin/auth in this codebase.
 *
 * This does the same verification Firebase's own docs describe as the
 * third-party-library path (see "Verify ID tokens using a third-party JWT
 * library"), against jsonwebtoken - a long-stable, pure-CJS package firebase-
 * admin itself already depends on - and Google's plain x509 cert endpoint,
 * which is a flat { kid: pemCert } map and needs no JWKS-to-PEM conversion.
 */

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const ISSUER_PREFIX = 'https://securetoken.google.com/'

interface CachedCerts {
  certs: Record<string, unknown>
  expiresAt: number
}

const DEFAULT_CERT_TTL_MS = 60 * 60 * 1000

/**
 * The key id comes from the token, so anyone can send one Google never
 * issued. Without a floor, each forged kid cost an outbound call; with it, a
 * burst of them costs at most one a minute, and a real rotation still lands
 * on the first unknown kid after that minute.
 */
const MIN_REFETCH_INTERVAL_MS = 60_000

let cached: CachedCerts | null = null
let inFlight: Promise<CachedCerts> | null = null
// When the last fetch started, whether or not it succeeded: a failing
// endpoint must not turn the floor back into one call per forged kid.
let lastFetchAt = Number.NEGATIVE_INFINITY

function cacheTtlMs(response: Response): number {
  const maxAge = response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]
  return maxAge ? Number(maxAge) * 1000 : DEFAULT_CERT_TTL_MS
}

async function downloadCerts(now: number): Promise<CachedCerts> {
  const response = await fetch(CERTS_URL)
  if (!response.ok) throw new Error(`fetching Google certs failed with ${response.status}`)

  const certs = (await response.json()) as Record<string, unknown>
  cached = { certs, expiresAt: now + cacheTtlMs(response) }
  return cached
}

/** Requests that need the certs at the same moment wait on one fetch rather than each sending their own. */
function refreshCerts(now: number): Promise<CachedCerts> {
  if (!inFlight) {
    lastFetchAt = now
    inFlight = downloadCerts(now).finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/** Only a PEM string Google itself listed: `certs.constructor` is not a certificate. */
function certIn(certs: Record<string, unknown>, kid: string): string | undefined {
  const cert = Object.hasOwn(certs, kid) ? certs[kid] : undefined
  return typeof cert === 'string' ? cert : undefined
}

/**
 * Google rotates signing keys with an overlap, so a token can arrive signed by
 * one the cached map predates. A miss is worth a second look only once the
 * last fetch is a minute old: before that, the map in hand is the answer.
 */
async function certFor(kid: string, now: number): Promise<string | undefined> {
  const current = cached && cached.expiresAt > now ? cached : await refreshCerts(now)
  const cert = certIn(current.certs, kid)
  if (cert !== undefined || now - lastFetchAt < MIN_REFETCH_INTERVAL_MS) return cert

  return certIn((await refreshCerts(now)).certs, kid)
}

export interface FirebaseIdTokenClaims extends jwt.JwtPayload {
  sub: string
  owner?: boolean
}

/** Throws on anything that doesn't check out - a bad signature, wrong project, an expired or not-yet-valid token. */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string
): Promise<FirebaseIdTokenClaims> {
  const decoded = jwt.decode(idToken, { complete: true })
  const kid = decoded && typeof decoded !== 'string' ? decoded.header.kid : undefined
  if (!kid) throw new Error('token has no key id')

  const cert = await certFor(kid, Date.now())
  if (!cert) throw new Error('no matching Google certificate for this key id')

  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `${ISSUER_PREFIX}${projectId}`,
  })
  if (typeof payload === 'string' || !payload.sub) throw new Error('token payload missing subject')

  // jsonwebtoken checks exp only when the token carries one, so a token
  // without it would never expire. Firebase always sets it.
  if (typeof payload.exp !== 'number') throw new Error('token has no expiry')

  // iat and auth_time in the future are the two Firebase asks for that
  // jsonwebtoken does not check, and either is otherwise a silent way to
  // smuggle a token that hasn't started yet past a check that only looks at
  // expiry. Same comparison for both: auth_time never follows iat in a real
  // token, so this cannot turn away one the iat check lets through.
  const nowSeconds = Date.now() / 1000
  if (typeof payload.iat === 'number' && payload.iat > nowSeconds) {
    throw new Error('token issued in the future')
  }
  if (payload.auth_time !== undefined && !(typeof payload.auth_time === 'number' && payload.auth_time <= nowSeconds)) {
    throw new Error('token authenticated in the future')
  }

  return payload as FirebaseIdTokenClaims
}
