import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { verifyFirebaseIdToken } = vi.hoisted(() => ({ verifyFirebaseIdToken: vi.fn() }))
vi.mock('@/lib/verifyFirebaseIdToken', () => ({ verifyFirebaseIdToken }))

const { requireOwner } = await import('../ownerRoute')

const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.a-real-looking-token.signature'

function request(token?: string) {
  return new NextRequest('https://example.com/api/sync/dispatch?profile=adam', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function warnings() {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  return () => warn.mock.calls.map(([line]) => JSON.parse(line as string))
}

const rejected = (reason: string) => [{ level: 'warn', event: 'request-rejected', route: '/api/sync/dispatch', reason }]

describe('requireOwner', () => {
  beforeEach(() => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'runomics-test')
    verifyFirebaseIdToken.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('lets the owner through without a word', async () => {
    const logged = warnings()
    verifyFirebaseIdToken.mockResolvedValue({ sub: 'u', owner: true })

    expect(await requireOwner(request(TOKEN))).toBeNull()
    expect(logged()).toEqual([])
  })

  it('logs a request with no token as unauthorized', async () => {
    const logged = warnings()

    expect((await requireOwner(request()))?.status).toBe(401)
    expect(logged()).toEqual(rejected('unauthorized'))
  })

  it('logs a token that failed verification as unauthorized, and never the token itself', async () => {
    const logged = warnings()
    verifyFirebaseIdToken.mockRejectedValue(new Error('jwt expired'))

    expect((await requireOwner(request(TOKEN)))?.status).toBe(401)
    expect(logged()).toEqual(rejected('unauthorized'))
    expect(JSON.stringify(logged())).not.toContain('a-real-looking-token')
  })

  it('logs a signed-in account without the owner claim as forbidden', async () => {
    const logged = warnings()
    verifyFirebaseIdToken.mockResolvedValue({ sub: 'someone-else' })

    expect((await requireOwner(request(TOKEN)))?.status).toBe(403)
    expect(logged()).toEqual(rejected('forbidden'))
  })

  it('logs a deployment with no Firebase project as not configured, since no owner can get in', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '')
    const logged = warnings()

    expect((await requireOwner(request(TOKEN)))?.status).toBe(503)
    expect(logged()).toEqual(rejected('not-configured'))
  })
})
