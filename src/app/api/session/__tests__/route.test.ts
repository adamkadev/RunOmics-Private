import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/siteAccess'

const verify = vi.hoisted(() => vi.fn())
vi.mock('@/lib/verifyFirebaseIdToken', () => ({ verifyFirebaseIdToken: verify }))

import { DELETE, POST } from '../route'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

function post(token?: string, origin = 'https://run.example') {
  return new NextRequest(new URL('/api/session', origin), {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('/api/session', () => {
  beforeEach(() => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'runomics-test')
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('RUNOMICS_VIEWERS', 'lamiaa@example.com')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    verify.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('gives the owner a month-long, script-proof cookie', async () => {
    verify.mockResolvedValue({ sub: 'uid-owner', owner: true, email: 'adam@example.com', email_verified: true })
    const response = await POST(post('id-token'))

    expect(response.status).toBe(200)
    expect(verify).toHaveBeenCalledWith('id-token', 'runomics-test')
    const header = response.headers.get('set-cookie') ?? ''
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite=lax/i)
    expect(header).toMatch(/Path=\//)
    expect(header).toMatch(/Max-Age=2592000/)
    const cookie = response.cookies.get(SESSION_COOKIE)!.value
    expect(verifySession(cookie, SECRET)).toMatchObject({ sub: 'uid-owner', owner: true, email: 'adam@example.com' })
  })

  it('lets an invited viewer in, by her verified email', async () => {
    verify.mockResolvedValue({ sub: 'uid-viewer', email: 'Lamiaa@Example.com', email_verified: true })
    const response = await POST(post('id-token'))
    expect(response.status).toBe(200)
    expect(verifySession(response.cookies.get(SESSION_COOKIE)!.value, SECRET)).toMatchObject({ owner: false, email: 'lamiaa@example.com' })
  })

  it('turns away an account nobody invited, and one whose email is unverified', async () => {
    verify.mockResolvedValue({ sub: 'uid-x', email: 'someone@example.com', email_verified: true })
    expect((await POST(post('id-token'))).status).toBe(403)

    verify.mockResolvedValue({ sub: 'uid-y', email: 'lamiaa@example.com', email_verified: false })
    const response = await POST(post('id-token'))
    expect(response.status).toBe(403)
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined()
  })

  it('answers 401 to no token and to one that does not verify', async () => {
    expect((await POST(post())).status).toBe(401)
    verify.mockRejectedValue(new Error('expired'))
    expect((await POST(post('stale'))).status).toBe(401)
  })

  it('answers 503 on a deployment without a secret', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    expect((await POST(post('id-token'))).status).toBe(503)
    expect(verify).not.toHaveBeenCalled()
  })

  it('keeps the cookie off Secure on a plain-http local build', async () => {
    verify.mockResolvedValue({ sub: 'uid-owner', owner: true })
    const response = await POST(post('id-token', 'http://192.168.1.20:3000'))
    expect(response.headers.get('set-cookie')).not.toMatch(/Secure/i)
  })

  it('ends the session on sign-out, and says whether the site is private', async () => {
    vi.stubEnv('RUNOMICS_PRIVATE', '1')
    const response = await DELETE(new NextRequest('https://run.example/api/session', { method: 'DELETE' }))
    expect(await response.json()).toEqual({ private: true })
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`${SESSION_COOKIE}=;.*Max-Age=0`, 'i'))
  })
})
