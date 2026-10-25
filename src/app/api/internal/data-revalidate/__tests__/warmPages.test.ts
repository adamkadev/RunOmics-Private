import { afterEach, describe, expect, it, vi } from 'vitest'
import { gateDecision } from '@/lib/siteAccess'

const { warmPages } = await import('../warmPages')

const ENV = { RUNOMICS_PRIVATE: '1', SESSION_SECRET: 'x'.repeat(40) }

afterEach(() => vi.restoreAllMocks())

describe('warmPages', () => {
  it('renders the main pages and the newest run past the gate, with a session that lapses within minutes', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchPage = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) => new Response('<html>', { status: url.endsWith('/plan') ? 500 : 200 }))

    await warmPages('https://runomics.example', async () => 'run-42', { env: ENV, fetchPage, settleMs: 0 })

    expect(fetchPage.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/', '/activities', '/plan', '/analytics', '/profile', '/activities/run-42'])
    const cookie = String((fetchPage.mock.calls[0]![1]!.headers as Record<string, string>).cookie).split('=')[1]
    expect(gateDecision({ pathname: '/', cookie, env: ENV })).toBe('pass')
    expect(gateDecision({ pathname: '/', cookie, env: ENV, nowMs: Date.now() + 10 * 60_000 })).toBe('signIn')
    expect(log.mock.calls[0]![0]).toMatch(/warmed 5\/6 pages .*\/plan HTTP 500/)
  })
})
