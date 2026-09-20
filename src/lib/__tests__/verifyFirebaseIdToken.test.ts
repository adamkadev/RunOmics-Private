import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import jwt from 'jsonwebtoken'

// A real RSA pair and real jwt.sign/verify throughout - this module's whole job
// is a cryptographic check, so a test that mocks jsonwebtoken would verify
// nothing but its own mock.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const PROJECT_ID = 'runomics-test'
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
const KID = 'test-kid-1'

function sign(payload: Record<string, unknown>, kid = KID): string {
  return jwt.sign(payload, PRIVATE_PEM, { algorithm: 'RS256', keyid: kid })
}

/** kid omitted from the header entirely - a default parameter would substitute on an explicit `undefined` too, so this needs its own call rather than `sign(payload, undefined)`. */
function signWithoutKid(payload: Record<string, unknown>): string {
  return jwt.sign(payload, PRIVATE_PEM, { algorithm: 'RS256' })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    sub: 'user-123',
    owner: true,
    iat: now - 5,
    exp: now + 3600,
    aud: PROJECT_ID,
    iss: ISSUER,
    ...overrides,
  }
}

function stubCertsEndpoint(certs: Record<string, string>, cacheControl: string | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => certs,
      headers: { get: (name: string) => (name === 'cache-control' ? cacheControl : null) },
    })
  )
}

beforeEach(() => {
  // The module caches certs at module scope, which would leak the previous
  // test's fetch stub and cert set into the next one.
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function subject() {
  return import('../verifyFirebaseIdToken')
}

describe('verifyFirebaseIdToken', () => {
  it('accepts a token signed by the key its kid points to', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    const claims = await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)

    expect(claims.sub).toBe('user-123')
    expect(claims.owner).toBe(true)
  })

  it('rejects a token whose audience is a different Firebase project', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await expect(
      verifyFirebaseIdToken(sign(validPayload({ aud: 'someone-elses-project' })), PROJECT_ID)
    ).rejects.toThrow()
  })

  it('rejects a token whose issuer does not match this project', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await expect(
      verifyFirebaseIdToken(sign(validPayload({ iss: 'https://securetoken.google.com/other-project' })), PROJECT_ID)
    ).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifyFirebaseIdToken(sign(validPayload({ iat: now - 7200, exp: now - 3600 })), PROJECT_ID)
    ).rejects.toThrow()
  })

  it('rejects a token issued in the future', async () => {
    // jsonwebtoken checks exp for us; this is the one Firebase's own spec asks
    // for that it does not - a token that hasn't started yet would otherwise
    // pass every other check.
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifyFirebaseIdToken(sign(validPayload({ iat: now + 3600, exp: now + 7200 })), PROJECT_ID)
    ).rejects.toThrow('issued in the future')
  })

  it('rejects a token whose signature does not match its own key id', async () => {
    // Signed by a real key, but the cert served under that kid belongs to a
    // different key entirely - the case a forged kid is trying to exploit.
    const otherKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const otherPublicPem = otherKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    stubCertsEndpoint({ [KID]: otherPublicPem })
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).rejects.toThrow()
  })

  it('rejects a token whose kid names a certificate Google never served', async () => {
    stubCertsEndpoint({ 'some-other-kid': PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).rejects.toThrow(
      'no matching Google certificate'
    )
  })

  it('rejects a token with no key id at all', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(signWithoutKid(validPayload()), PROJECT_ID)).rejects.toThrow(
      'no key id'
    )
  })

  it('fetches Google’s certs once and reuses them for a second token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [KID]: PUBLIC_PEM }),
      headers: { get: () => null },
    })
    vi.stubGlobal('fetch', fetchSpy)
    const { verifyFirebaseIdToken } = await subject()

    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)
    await verifyFirebaseIdToken(sign(validPayload({ sub: 'user-456' })), PROJECT_ID)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('surfaces a failed fetch rather than caching an empty cert set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).rejects.toThrow('503')
  })

  it('refetches the certs when a token arrives signed by a key it has never seen', async () => {
    // Google rotates signing keys on its own schedule, and a token signed with
    // the new one arrives while the old cert map is still inside its TTL -
    // that overlap is the point of the rotation. Trusting the cache blindly
    // turned it into "no matching Google certificate" and locked the owner out
    // of their own Settings until the TTL ran down.
    const rotated = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rotatedPublic = rotated.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const rotatedPrivate = rotated.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

    let generation = 0
    const fetchSpy = vi.fn().mockImplementation(async () => ({
      ok: true,
      // Second call is after the rotation: Google now serves both keys.
      json: async () =>
        ++generation === 1 ? { [KID]: PUBLIC_PEM } : { [KID]: PUBLIC_PEM, 'rotated-kid': rotatedPublic },
      headers: { get: () => 'max-age=3600' },
    }))
    vi.stubGlobal('fetch', fetchSpy)
    const { verifyFirebaseIdToken } = await subject()

    // Warms the cache with the pre-rotation map, well inside its hour.
    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)

    const rotatedToken = jwt.sign(validPayload(), rotatedPrivate, {
      algorithm: 'RS256',
      keyid: 'rotated-kid',
    })
    const claims = await verifyFirebaseIdToken(rotatedToken, PROJECT_ID)

    expect(claims.sub).toBe('user-123')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not refetch on every unknown kid, so a forged token cannot drive traffic at Google', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [KID]: PUBLIC_PEM }),
      headers: { get: () => 'max-age=3600' },
    })
    vi.stubGlobal('fetch', fetchSpy)
    const { verifyFirebaseIdToken } = await subject()

    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)
    fetchSpy.mockClear()

    // One refetch to be sure, then the freshly-fetched map is the answer.
    await expect(
      verifyFirebaseIdToken(sign(validPayload(), 'forged-kid'), PROJECT_ID)
    ).rejects.toThrow('no matching Google certificate')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
