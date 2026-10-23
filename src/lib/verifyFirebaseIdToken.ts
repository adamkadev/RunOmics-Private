import 'server-only'
import jwt from 'jsonwebtoken'

/**
 * Firebase's third-party JWT library path, not firebase-admin/auth: its
 * jwks-rsa require()s the pure-ESM jose and throws ERR_REQUIRE_ESM on Node.
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
 * The key id comes from the token, so anyone can forge one: this floor caps
 * the outbound calls a burst of forged kids costs at one a minute.
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

/** Google rotates signing keys with an overlap, so a token can be signed by one the cached map predates. */
async function certFor(kid: string, now: number): Promise<string | undefined> {
  const current = cached && cached.expiresAt > now ? cached : await refreshCerts(now)
  const cert = certIn(current.certs, kid)
  if (cert !== undefined || now - lastFetchAt < MIN_REFETCH_INTERVAL_MS) return cert

  return certIn((await refreshCerts(now)).certs, kid)
}

export interface FirebaseIdTokenClaims extends jwt.JwtPayload {
  sub: string
  owner?: boolean
  email?: string
  email_verified?: boolean
}

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

  // jsonwebtoken checks exp only when the token carries one.
  if (typeof payload.exp !== 'number') throw new Error('token has no expiry')

  // Firebase requires iat and auth_time not in the future; jsonwebtoken does not check them.
  const nowSeconds = Date.now() / 1000
  if (typeof payload.iat === 'number' && payload.iat > nowSeconds) {
    throw new Error('token issued in the future')
  }
  if (payload.auth_time !== undefined && !(typeof payload.auth_time === 'number' && payload.auth_time <= nowSeconds)) {
    throw new Error('token authenticated in the future')
  }

  return payload as FirebaseIdTokenClaims
}
