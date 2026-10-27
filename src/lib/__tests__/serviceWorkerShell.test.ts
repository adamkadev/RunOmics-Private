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
    for (const file of files) {
      const route = join(process.cwd(), 'src', 'app', file, 'route.ts')
      expect(existsSync(join(PUBLIC, file)) || existsSync(route), file).toBe(true)
    }
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

describe('the service worker’s notifications', () => {
  function worker() {
    const listeners: Record<string, (event: unknown) => void> = {}
    const shown: { title: string; options: Record<string, unknown> }[] = []
    const window = { focus: vi.fn(), navigate: vi.fn() }
    const clients = { openWindow: vi.fn(), matchAll: vi.fn(async () => [window]) }
    const scope = {
      location: { href: 'https://runomics.example/sw.js?v=test', hostname: 'runomics.example', origin: 'https://runomics.example' },
      addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
      registration: { showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }) },
      clients,
    }
    new Function('self', 'caches', 'fetch', readFileSync(join(PUBLIC, 'sw.js'), 'utf8'))(scope, {}, () => {})
    return { listeners, shown, clients, window }
  }

  async function dispatch(listener: (event: unknown) => void, event: Record<string, unknown>) {
    let work: Promise<unknown> = Promise.resolve()
    listener({ ...event, waitUntil: (promise: Promise<unknown>) => (work = promise) })
    await work
  }

  it('shows the push under its tag and keeps its link for the tap', async () => {
    const { listeners, shown } = worker()
    const payload = {
      notification: { title: 'New PR: 5K', body: '19:10', tag: 'record:5k' },
      fcmOptions: { link: 'https://runomics.example/activities/a1' },
    }

    await dispatch(listeners.push!, { data: { json: () => payload } })

    expect(shown[0]!.title).toBe('New PR: 5K')
    expect(shown[0]!.options).toMatchObject({ tag: 'record:5k', data: { url: 'https://runomics.example/activities/a1' } })
  })

  it('opens the app’s own link in its window, and a GitHub run in a new one', async () => {
    const { listeners, clients, window } = worker()
    const tap = (url: string) => dispatch(listeners.notificationclick!, { notification: { close: () => {}, data: { url } } })

    await tap('https://runomics.example/plan')
    expect(window.navigate).toHaveBeenCalledWith('https://runomics.example/plan')

    await tap('https://github.com/adamkadev/RunOmics-Private/actions/runs/1')
    expect(clients.openWindow).toHaveBeenCalledWith('https://github.com/adamkadev/RunOmics-Private/actions/runs/1')
    expect(window.navigate).toHaveBeenCalledTimes(1)
  })
})
