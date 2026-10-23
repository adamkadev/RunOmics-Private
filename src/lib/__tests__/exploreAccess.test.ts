import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '@/proxy'

const requireOwner = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ownerRoute', () => ({ requireOwner }))

const { authorizeExploreCaller, clientIp } = await import('../exploreAccess')

const request = (headers: Record<string, string> = {}) =>
  new NextRequest('https://run.example/api/explore/route', { method: 'POST', headers })

describe('authorizeExploreCaller', () => {
  beforeEach(() => {
    requireOwner.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lets anyone the private site’s gate let in through, counted by address', async () => {
    vi.stubEnv('RUNOMICS_PRIVATE', '1')

    expect(await authorizeExploreCaller(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toEqual({
      ok: true,
      key: 'ip:203.0.113.7',
    })
    expect(requireOwner).not.toHaveBeenCalled()
  })

  it('reads "private" exactly as the proxy does', async () => {
    vi.stubEnv('RUNOMICS_PRIVATE', 'TRUE')

    expect((await authorizeExploreCaller(request())).ok).toBe(true)
    expect(requireOwner).not.toHaveBeenCalled()
  })

  it('asks a public site’s caller for the owner’s token, and passes its refusal on', async () => {
    vi.stubEnv('RUNOMICS_PRIVATE', '')
    const refusal = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    requireOwner.mockResolvedValue(refusal)

    expect(await authorizeExploreCaller(request())).toEqual({ ok: false, response: refusal })
  })

  it('counts the owner as one caller on every device', async () => {
    vi.stubEnv('RUNOMICS_PRIVATE', '0')
    requireOwner.mockResolvedValue(null)

    expect(await authorizeExploreCaller(request({ 'x-forwarded-for': '203.0.113.7' }))).toEqual({ ok: true, key: 'owner' })
  })
})

// The private-site branch above trusts the proxy's gate: /api/explore/* left out of its matcher, or made
// a public path, would open the routing key to anyone.
describe('the gate a private site relies on', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(['/api/explore/route', '/api/explore/areas/demo'])('turns away a signed-out call to %s', async (path) => {
    vi.stubEnv('RUNOMICS_PRIVATE', '1')
    vi.stubEnv('SESSION_SECRET', 'a-test-secret-that-is-long-enough-1234567890')

    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true)
    const response = proxy(new NextRequest(new URL(path, 'https://run.example'), { method: 'POST' }))
    expect(response.status).toBe(401)
  })
})

describe('clientIp', () => {
  it('takes the first forwarded address, then x-real-ip', () => {
    expect(clientIp(request({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientIp(request({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIp(request())).toBe('unknown')
  })
})
