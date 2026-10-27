import { afterEach, describe, expect, it, vi } from 'vitest'
import { absolutePushLink, appOrigin, pushPaths } from '../pushLinks'

describe('push links', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers APP_URL to Vercel’s production domain, and keeps only its https origin', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'demo-project.example.com')
    vi.stubEnv('APP_URL', 'https://run.example.com/')
    expect(appOrigin()).toBe('https://run.example.com')

    vi.stubEnv('APP_URL', '')
    expect(appOrigin()).toBe('https://demo-project.example.com')

    vi.stubEnv('APP_URL', 'http://localhost:3000')
    expect(appOrigin()).toBeNull()
  })

  it('keeps an absolute https link, and refuses any other scheme or a protocol-relative path', () => {
    vi.stubEnv('APP_URL', 'https://run.example.com')
    const run = 'https://github.com/adamkadev/RunOmics-Private/actions/runs/1'

    expect(absolutePushLink(run)).toBe(run)
    expect(absolutePushLink('/plan')).toBe('https://run.example.com/plan')
    expect(absolutePushLink('//evil.example/x')).toBeUndefined()
    expect(absolutePushLink('javascript:alert(1)')).toBeUndefined()
    expect(absolutePushLink(undefined)).toBeUndefined()
  })

  it('escapes ids into their path', () => {
    expect(pushPaths.run('123')).toBe('/activities/123')
    expect(pushPaths.shoe('gear/1')).toBe('/shoes/gear%2F1')
  })
})
