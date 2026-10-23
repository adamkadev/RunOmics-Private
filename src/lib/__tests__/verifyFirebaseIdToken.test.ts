import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import jwt from 'jsonwebtoken'

// Real RSA keys and jwt.sign/verify: a test that mocks jsonwebtoken would verify nothing but its own mock.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const PROJECT_ID = 'runomics-test'
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
const KID = 'test-kid-1'

function sign(payload: Record<string, unknown>, kid = KID): string {
  return jwt.sign(payload, PRIVATE_PEM, { algorithm: 'RS256', keyid: kid })
}

/** A default parameter substitutes on an explicit `undefined` too, so omitting kid needs its own call. */
function signWithoutKid(payload: Record<string, unknown>): string {
  return jwt.sign(payload, PRIVATE_PEM, { algorithm: 'RS256' })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    sub: 'user-123',
    owner: true,
    auth_time: now - 60,
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

function countingCertsEndpoint(certs: Record<string, unknown>) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => certs,
    headers: { get: () => 'max-age=3600' },
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

beforeEach(() => {
  // The module caches certs at module scope, which would leak the previous
  // test's fetch stub and cert set into the next one.
  vi.resetModules()
  // Only the clock is faked: the refetch interval is measured on Date.now(),
  // and so are the tokens' iat and exp, so both move together.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
    // jsonwebtoken checks exp but not iat, which Firebase's spec asks for.
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
    vi.advanceTimersByTime(61_000)

    const rotatedToken = jwt.sign(validPayload(), rotatedPrivate, {
      algorithm: 'RS256',
      keyid: 'rotated-kid',
    })
    const claims = await verifyFirebaseIdToken(rotatedToken, PROJECT_ID)

    expect(claims.sub).toBe('user-123')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not refetch for unknown kids while its certs are under a minute old', async () => {
    // Otherwise each forged kid costs one outbound call to Google.
    const fetchSpy = countingCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)

    for (const kid of ['forged-1', 'forged-2', 'forged-3', 'forged-4', 'forged-5']) {
      await expect(verifyFirebaseIdToken(sign(validPayload(), kid), PROJECT_ID)).rejects.toThrow(
        'no matching Google certificate'
      )
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refetches once for a burst of unknown kids after that minute, not once per kid', async () => {
    const fetchSpy = countingCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)
    vi.advanceTimersByTime(61_000)

    for (const kid of ['forged-1', 'forged-2', 'forged-3', 'forged-4', 'forged-5']) {
      await expect(verifyFirebaseIdToken(sign(validPayload(), kid), PROJECT_ID)).rejects.toThrow(
        'no matching Google certificate'
      )
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('shares one fetch between verifications that arrive together on a cold cache', async () => {
    const fetchSpy = countingCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    const claims = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((sub) => verifyFirebaseIdToken(sign(validPayload({ sub })), PROJECT_ID))
    )

    expect(claims.map((c) => c.sub)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fetches again after a failed fetch rather than keeping the failure', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => ({ [KID]: PUBLIC_PEM }), headers: { get: () => null } })
    vi.stubGlobal('fetch', fetchSpy)
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).rejects.toThrow('503')
    expect((await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).sub).toBe('user-123')
  })

  it('counts a failed refetch toward the minute too, so an outage does not reopen the door', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ [KID]: PUBLIC_PEM }), headers: { get: () => 'max-age=3600' } })
      .mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchSpy)
    const { verifyFirebaseIdToken } = await subject()

    await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)
    vi.advanceTimersByTime(61_000)

    await expect(verifyFirebaseIdToken(sign(validPayload(), 'forged-1'), PROJECT_ID)).rejects.toThrow('503')
    await expect(verifyFirebaseIdToken(sign(validPayload(), 'forged-2'), PROJECT_ID)).rejects.toThrow(
      'no matching Google certificate'
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    // The cached map still verifies a real token throughout.
    expect((await verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).sub).toBe('user-123')
  })

  it('looks a kid up among the certs Google served, not the properties every object has', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()

    for (const kid of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      await expect(verifyFirebaseIdToken(sign(validPayload(), kid), PROJECT_ID)).rejects.toThrow(
        'no matching Google certificate'
      )
    }
  })

  it('never hands jsonwebtoken a certificate that is not a PEM string', async () => {
    stubCertsEndpoint({ [KID]: { pem: PUBLIC_PEM } } as unknown as Record<string, string>)
    const { verifyFirebaseIdToken } = await subject()

    await expect(verifyFirebaseIdToken(sign(validPayload()), PROJECT_ID)).rejects.toThrow(
      'no matching Google certificate'
    )
  })

  it('rejects a token with no expiry, which jsonwebtoken would accept forever', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()
    const neverExpires: Record<string, unknown> = validPayload()
    delete neverExpires.exp

    await expect(verifyFirebaseIdToken(sign(neverExpires), PROJECT_ID)).rejects.toThrow('no expiry')
  })

  it('rejects a token whose sign-in is dated in the future', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()
    const now = Math.floor(Date.now() / 1000)

    await expect(
      verifyFirebaseIdToken(sign(validPayload({ auth_time: now + 3600 })), PROJECT_ID)
    ).rejects.toThrow('authenticated in the future')
  })

  it('accepts a token whose sign-in was days ago, as a refreshed token is', async () => {
    stubCertsEndpoint({ [KID]: PUBLIC_PEM })
    const { verifyFirebaseIdToken } = await subject()
    const now = Math.floor(Date.now() / 1000)

    const claims = await verifyFirebaseIdToken(sign(validPayload({ auth_time: now - 9 * 86_400 })), PROJECT_ID)

    expect(claims.sub).toBe('user-123')
  })
})
