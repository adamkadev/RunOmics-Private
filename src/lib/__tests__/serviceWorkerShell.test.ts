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
  function worker() {
    const listeners: Record<string, (event: unknown) => void> = {}
    const cached = new Response('cached page')
    const scope = {
      location: { href: 'https://runomics.example/sw.js?v=test', hostname: 'runomics.example', origin: 'https://runomics.example' },
      addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
      registration: {},
      clients: {},
    }
    const caches = { match: async () => cached, open: async () => ({ put: async () => {} }) }
    new Function('self', 'caches', 'fetch', readFileSync(join(PUBLIC, 'sw.js'), 'utf8'))(scope, caches, () => new Promise(() => {}))
    return listeners
  }

  it('opens a page from its cached copy when the network has not answered in 3 s', async () => {
    vi.useFakeTimers()
    let answer: Promise<Response> | undefined
    worker().fetch!({
      request: { method: 'GET', url: 'https://runomics.example/plan', mode: 'navigate' },
      preloadResponse: Promise.resolve(undefined),
      respondWith: (response: Promise<Response>) => (answer = response),
      waitUntil: () => {},
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(await (await answer!).text()).toBe('cached page')
    vi.useRealTimers()
  })
})
