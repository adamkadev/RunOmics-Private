import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '../proxy'
import { SESSION_COOKIE, signSession } from '@/lib/siteAccess'
import { workerUrl } from '@/lib/maplibre'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

function request(path: string, cookie?: string) {
  const req = new NextRequest(new URL(path, 'https://run.example'))
  if (cookie) req.cookies.set(SESSION_COOKIE, cookie)
  return req
}

describe('the proxy', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('passes every request through while the site is public', () => {
    vi.stubEnv('RUNOMICS_PRIVATE', '')
    const response = proxy(request('/plan'))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  describe('on a private site', () => {
    function makePrivate() {
      vi.stubEnv('RUNOMICS_PRIVATE', '1')
      vi.stubEnv('SESSION_SECRET', SECRET)
      vi.stubEnv('RUNOMICS_VIEWERS', '')
    }

    it('sends a signed-out page view to sign-in, and back after', () => {
      makePrivate()
      const response = proxy(request('/plan?view=month&_rsc=1x2y'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://run.example/sign-in?next=%2Fplan%3Fview%3Dmonth')

      expect(proxy(request('/')).headers.get('location')).toBe('https://run.example/sign-in')
    })

    it('answers a signed-out API call with a 401, not a page', async () => {
      makePrivate()
      const response = proxy(request('/api/map/routes'))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Sign in required' })
    })

    it('lets the owner through', () => {
      makePrivate()
      const cookie = signSession({ sub: 'uid', owner: true, email: 'adam@example.com' }, SECRET)
      expect(proxy(request('/plan', cookie)).headers.get('x-middleware-next')).toBe('1')
    })

    it('keeps sign-in itself open', () => {
      makePrivate()
      expect(proxy(request('/sign-in?next=%2Fplan')).headers.get('x-middleware-next')).toBe('1')
    })
  })

  // The matcher decides what the proxy never sees: what a signed-out browser
  // must load to sign in or install the app, and nothing with data in it.
  describe('its matcher', () => {
    const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url })

    it('covers every page and API', () => {
      for (const url of ['/', '/plan', '/activities/123', '/sign-in', '/api/map/routes', '/api/activities/export', '/api/internal/pr-check']) {
        expect(runsOn(url), url).toBe(true)
      }
    })

    it('skips the build, the icons, the manifest and the workers', () => {
      for (const url of [
        '/_next/static/chunks/app.js',
        '/_next/image?url=%2Ficons%2Fweb-192.png&w=64&q=75',
        '/icons/apple-touch-icon.png',
        '/icons/splash/iphone-16-portrait.png',
        workerUrl('6.15.0'),
        '/manifest.json',
        '/sw.js',
        '/firebase-messaging-sw.js',
        '/robots.txt',
      ]) {
        expect(runsOn(url), url).toBe(false)
      }
    })

    it('is not fooled by a page named like a skipped file', () => {
      expect(runsOn('/manifest.json.bak')).toBe(true)
      expect(runsOn('/iconsx')).toBe(true)
    })
  })
})
