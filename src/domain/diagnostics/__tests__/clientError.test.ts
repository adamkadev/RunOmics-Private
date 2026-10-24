import { describe, expect, it } from 'vitest'
import { parseClientError } from '../clientError'

const AT = new Date('2026-10-24T19:33:00Z')

describe('parseClientError', () => {
  it('keeps the path alone and cuts anything that could be a coordinate', () => {
    const report = parseClientError(
      { source: 'route', message: 'TypeError: cannot plan from [6.17345, 49.11987]', page: '/activities?view=map&explore=route', build: 'abc1234', device: 'iOS 26.1 · Safari PWA' },
      AT,
    )
    expect(report).toEqual({
      at: '2026-10-24T19:33:00.000Z',
      source: 'route',
      message: 'TypeError: cannot plan from [#, #]',
      page: '/activities',
      build: 'abc1234',
      device: 'iOS 26.1 · Safari PWA',
    })
  })

  it('refuses an unknown source or an empty message', () => {
    expect(parseClientError({ source: 'console', message: 'x' }, AT)).toBeNull()
    expect(parseClientError({ source: 'error', message: '   ' }, AT)).toBeNull()
    expect(parseClientError(null, AT)).toBeNull()
  })
})
