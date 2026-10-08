import { afterEach, describe, expect, it, vi } from 'vitest'
import { endSiteSession, openSiteSession, safeNextPath } from '../siteSession'

describe('the way back after signing in', () => {
  it('is a page of this site', () => {
    expect(safeNextPath('/plan?view=month')).toBe('/plan?view=month')
    expect(safeNextPath('/activities/42#splits')).toBe('/activities/42#splits')
  })

  it('is never another site, sign-in itself, or nothing', () => {
    for (const next of [null, undefined, '', 'plan', 'https://evil.example/', '//evil.example/x', '/\\evil.example', '/sign-in', '/sign-in?next=%2F']) {
      expect(safeNextPath(next), String(next)).toBe('/')
    }
  })
})

describe('opening and ending the session', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the server’s answer', async () => {
    for (const [status, answer] of [[200, 'open'], [403, 'notInvited'], [503, 'unavailable'], [401, 'failed']] as const) {
      const fetchMock = vi.fn().mockResolvedValue({ ok: status === 200, status })
      vi.stubGlobal('fetch', fetchMock)
      expect(await openSiteSession('id-token')).toBe(answer)
      expect(fetchMock).toHaveBeenCalledWith('/api/session', { method: 'POST', headers: { authorization: 'Bearer id-token' } })
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await openSiteSession('id-token')).toBe('failed')
  })

  it('clears the cached pages, and only them, when the site is private', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ private: true }) }))
    const deleted: string[] = []
    vi.stubGlobal('caches', {
      keys: async () => ['runomics-pages-4.30.0', 'runomics-static-4.30.0'],
      delete: async (key: string) => deleted.push(key),
    })
    expect(await endSiteSession()).toEqual({ private: true })
    expect(deleted).toEqual(['runomics-pages-4.30.0'])
  })

  it('leaves the cache alone on a public site, or offline', async () => {
    const keys = vi.fn().mockResolvedValue([])
    vi.stubGlobal('caches', { keys, delete: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ private: false }) }))
    expect(await endSiteSession()).toEqual({ private: false })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await endSiteSession()).toEqual({ private: false })
    expect(keys).not.toHaveBeenCalled()
  })
})
