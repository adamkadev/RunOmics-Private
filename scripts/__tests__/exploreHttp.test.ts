import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backoffMs, cachedFetch, cacheKey, HttpError, USER_AGENT, type FetchOptions } from '../explore/http'

let cacheDir: string
const sleeps: number[] = []
const options = (extra: Partial<FetchOptions> = {}): FetchOptions => ({
  refresh: false,
  cacheDir,
  sleep: async (ms) => {
    sleeps.push(ms)
  },
  log: () => {},
  ...extra,
})

const reply = (status: number, body = '', headers: Record<string, string> = {}) => new Response(body, { status, headers })

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'explore-http-'))
  sleeps.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(cacheDir, { recursive: true, force: true })
})

describe('cachedFetch', () => {
  it('names itself, posts the form, and caches the answer under a hash', async () => {
    const fetch = vi.fn(async () => reply(200, '{"elements":[]}'))
    vi.stubGlobal('fetch', fetch)
    const request = { label: 'tile', url: 'https://overpass.example/api/interpreter', form: { data: 'way(1,2,3,4);' } }

    const first = await cachedFetch(request, options())
    expect(first).toMatchObject({ text: '{"elements":[]}', cached: false, attempts: 1 })
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT)
    expect(init.body).toBe('data=way%281%2C2%2C3%2C4%29%3B')

    // Only the hash names the file: no bbox reaches the disk as a name.
    expect(readdirSync(cacheDir)).toEqual([`${cacheKey(request.url, String(init.body))}.txt`])

    const second = await cachedFetch(request, options())
    expect(second).toMatchObject({ text: '{"elements":[]}', cached: true })
    expect(fetch).toHaveBeenCalledTimes(1)

    await cachedFetch(request, options({ refresh: true }))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('retries what capacity limits throw, backing off, and caches only the good answer', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(504))
      .mockResolvedValueOnce(reply(429, '', { 'retry-after': '60' }))
      .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'))
      .mockResolvedValueOnce(reply(200, '{"elements":[],"remark":"runtime error: Query timed out"}'))
      .mockResolvedValueOnce(reply(200, '{"elements":[]}'))
    vi.stubGlobal('fetch', fetch)
    const validate = (text: string) => (text.includes('remark') ? 'partial' : null)

    const result = await cachedFetch({ label: 'tile', url: 'https://overpass.example', validate }, options())
    expect(result).toMatchObject({ cached: false, attempts: 5 })
    expect(sleeps).toEqual([20_000, 60_000, 80_000, 90_000])
    expect(readdirSync(cacheDir)).toHaveLength(1)
  })

  it('gives up after the last attempt, naming the last failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(502)))
    await expect(cachedFetch({ label: 'tile', url: 'https://overpass.example' }, options({ attempts: 3 }))).rejects.toThrow(
      'tile: gave up after 3 attempts (last: HTTP 502)',
    )
    expect(readdirSync(cacheDir)).toEqual([])
  })

  it('does not retry an answer that will not change, such as a 406 or a 400', async () => {
    const fetch = vi.fn(async () => reply(406))
    vi.stubGlobal('fetch', fetch)
    const error = await cachedFetch({ label: 'tile', url: 'https://overpass.example' }, options()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(406)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches a cached answer that no longer validates', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(200, 'old')).mockResolvedValueOnce(reply(200, '{"features":[]}'))
    vi.stubGlobal('fetch', fetch)
    await cachedFetch({ label: 'wfs', url: 'https://wfs.example' }, options())
    const result = await cachedFetch({ label: 'wfs', url: 'https://wfs.example', validate: (t) => (t.startsWith('{') ? null : 'not JSON') }, options())
    expect(result).toMatchObject({ text: '{"features":[]}', cached: false })
  })
})

describe('backoffMs', () => {
  it('doubles from 20 s up to 90 s, and honours a longer retry-after within that cap', () => {
    expect([1, 2, 3, 4, 5].map((attempt) => backoffMs(attempt))).toEqual([20_000, 40_000, 80_000, 90_000, 90_000])
    expect(backoffMs(1, 30)).toBe(30_000)
    expect(backoffMs(1, 600)).toBe(90_000)
    expect(backoffMs(3, 5)).toBe(80_000)
  })
})
