import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestError } from '../instrumentation'

const REQUEST = {
  path: '/activities/12345?tab=splits&since=2026-09-24',
  method: 'GET',
  headers: {
    cookie: 'session=cookie-value-1',
    authorization: 'Bearer token-value-2',
    'x-internal-secret': 'secret-value-3',
  },
}

const CONTEXT = {
  routerKind: 'App Router',
  routePath: '/activities/[id]',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
} as const

function logged(): Record<string, unknown>[] {
  const error = vi.mocked(console.error)
  return error.mock.calls.map(([line]) => JSON.parse(line as string))
}

describe('onRequestError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('logs one JSON line naming the route, the method and what broke', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(new TypeError("Cannot read properties of undefined (reading 'icon')"), REQUEST, CONTEXT)

    expect(logged()).toEqual([
      {
        level: 'error',
        event: 'request-error',
        method: 'GET',
        path: '/activities/12345',
        route: '/activities/[id]',
        routeType: 'render',
        error: { name: 'TypeError', message: "Cannot read properties of undefined (reading 'icon')" },
      },
    ])
  })

  it('carries the digest a render error shows the visitor, so the two can be matched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(Object.assign(new Error('boom'), { digest: '2716381430' }), REQUEST, CONTEXT)

    expect(logged()[0]).toMatchObject({ digest: '2716381430' })
  })

  it('never logs the headers, the cookies or the query string that came with the request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(new Error('boom'), REQUEST, CONTEXT)

    const line = vi.mocked(console.error).mock.calls[0]?.[0] as string
    expect(line).not.toMatch(/cookie-value-1|token-value-2|secret-value-3|since=|tab=/)
  })

  it('keeps a long message to a readable length', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(new Error('x'.repeat(5_000)), REQUEST, CONTEXT)

    expect((logged()[0]?.error as { message: string }).message).toHaveLength(300)
  })

  it('redacts a secret the error message happens to quote', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'AIzaSy-a-real-looking-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(new Error('request to ?key=AIzaSy-a-real-looking-key failed'), REQUEST, CONTEXT)

    expect(logged()[0]?.error).toEqual({ name: 'Error', message: 'request to ?key=[redacted] failed' })
  })

  it('redacts the routing key as well', async () => {
    vi.stubEnv('ORS_API_KEY', 'ors-a-real-looking-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError(new Error('openrouteservice refused ors-a-real-looking-key'), REQUEST, CONTEXT)

    expect(logged()[0]?.error).toEqual({ name: 'Error', message: 'openrouteservice refused [redacted]' })
  })

  it('still says something useful when what was thrown is not an Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await onRequestError('a bare string', REQUEST, CONTEXT)

    expect(logged()[0]?.error).toEqual({ name: 'string', message: 'a bare string' })
  })
})
