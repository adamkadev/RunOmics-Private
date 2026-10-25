import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const PUBLIC = join(process.cwd(), 'public')

describe('the service worker shell', () => {
  // One missing file fails cache.addAll and with it the whole install.
  it('pre-caches only files that exist', () => {
    const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8')
    const list = sw.match(/const SHELL_URLS = \[([^\]]*)\]/)?.[1]
    expect(list).toBeDefined()
    const files = [...list!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).filter((u) => u !== '/')
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(existsSync(join(PUBLIC, file)), file).toBe(true)
  })
})

describe('the service worker on a slow network', () => {
  function worker({ network = () => new Promise<Response>(() => {}), put = async () => {} } = {}) {
    const listeners: Record<string, (event: unknown) => void> = {}
    const cached = new Response('cached page')
    const scope = {
      location: { href: 'https://runomics.example/sw.js?v=test', hostname: 'runomics.example', origin: 'https://runomics.example' },
      addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
      registration: {},
      clients: {},
    }
    const caches = { match: async () => cached, open: async () => ({ put }) }
    new Function('self', 'caches', 'fetch', readFileSync(join(PUBLIC, 'sw.js'), 'utf8'))(scope, caches, network)
    return listeners
  }

  function visit(path: string, { mode = 'cors', headers = {} }: { mode?: string; headers?: Record<string, string> } = {}) {
    const event = {
      request: { method: 'GET', url: `https://runomics.example${path}`, mode, headers: new Headers(headers) },
      preloadResponse: Promise.resolve(undefined),
      answer: undefined as Promise<Response> | undefined,
      respondWith: (response: Promise<Response>) => (event.answer = response),
      waitUntil: () => {},
    }
    return event
  }

  it('opens a page from its cached copy when the network has not answered in 3 s', async () => {
    vi.useFakeTimers()
    const event = visit('/plan', { mode: 'navigate' })
    worker().fetch!(event)
    await vi.advanceTimersByTimeAsync(3000)
    expect(await (await event.answer!).text()).toBe('cached page')
    vi.useRealTimers()
  })

  it('hands a page over before its copy reaches the cache', async () => {
    const event = visit('/plan?_rsc=1')
    worker({ network: async () => new Response('fresh page'), put: () => new Promise(() => {}) }).fetch!(event)
    expect(await (await event.answer!).text()).toBe('fresh page')
  })

  it("keeps MapLibre's versioned worker from the cache, with no trip to the network", async () => {
    const event = visit('/maplibre/6.15.0/maplibre-gl-worker.mjs')
    worker().fetch!(event)
    expect(await (await event.answer!).text()).toBe('cached page')
  })

  it('leaves a prefetch to the network', () => {
    const event = visit('/plan?_rsc=2', { headers: { 'Next-Router-Prefetch': '1' } })
    worker().fetch!(event)
    expect(event.answer).toBeUndefined()
  })
})
