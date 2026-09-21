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
  certs: Record<string, string>
  expiresAt: number
}

const DEFAULT_CERT_TTL_MS = 60 * 60 * 1000

let cached: CachedCerts | null = null

function cacheTtlMs(response: Response): number {
  const maxAge = response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]
  return maxAge ? Number(maxAge) * 1000 : DEFAULT_CERT_TTL_MS
}

async function refreshCerts(now: number): Promise<Record<string, string>> {
  const response = await fetch(CERTS_URL)
  if (!response.ok) throw new Error(`fetching Google certs failed with ${response.status}`)

  const certs = (await response.json()) as Record<string, string>
  cached = { certs, expiresAt: now + cacheTtlMs(response) }
  return certs
}

/**
 * Google rotates signing keys with an overlap, so a token can arrive signed by
 * one the cached map predates. Only a cached miss is worth a second look.
 */
async function certFor(kid: string, now: number): Promise<string | undefined> {
  const cachedCerts = cached && cached.expiresAt > now ? cached.certs : null
  const certs = cachedCerts ?? (await refreshCerts(now))
  if (certs[kid]) return certs[kid]

  // A miss against the cache may just be a key newer than it. A miss against a
  // map we only just fetched is the real answer.
  return cachedCerts ? (await refreshCerts(now))[kid] : undefined
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

  // jsonwebtoken checks exp for us; iat in the future is the one Firebase asks
  // for that it does not, and is otherwise a silent way to smuggle a token
  // that hasn't started yet past a check that only looks at expiry.
  if (typeof payload.iat === 'number' && payload.iat > Date.now() / 1000) {
    throw new Error('token issued in the future')
  }

  return payload as FirebaseIdTokenClaims
}
