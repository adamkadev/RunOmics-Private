import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../rateLimit'

const T0 = 1_000_000

describe('createRateLimiter', () => {
  it('lets max takes through in a window and refuses the next, saying when to come back', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000, maxKeys: 10 })

    expect([0, 1, 2].map((i) => limiter.take('a', T0 + i)).every((d) => d.ok)).toBe(true)
    expect(limiter.take('a', T0 + 20_000)).toEqual({ ok: false, retryAfterS: 40 })
  })

  it('counts each key on its own', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 10 })

    expect(limiter.take('a', T0).ok).toBe(true)
    expect(limiter.take('b', T0).ok).toBe(true)
    expect(limiter.take('a', T0).ok).toBe(false)
  })

  it('opens a new window once the old one has closed', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 10 })

    limiter.take('a', T0)
    expect(limiter.take('a', T0 + 59_999).ok).toBe(false)
    expect(limiter.take('a', T0 + 60_000).ok).toBe(true)
    expect(limiter.take('a', T0 + 60_001).ok).toBe(false)
  })

  it('never says to come back in under a second', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 10 })

    limiter.take('a', T0)
    expect(limiter.take('a', T0 + 59_999)).toEqual({ ok: false, retryAfterS: 1 })
  })

  it('does not count a refused take against the next window', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 10 })

    for (let i = 0; i < 10; i++) limiter.take('a', T0)
    expect(limiter.take('a', T0 + 1000).ok).toBe(true)
    expect(limiter.take('a', T0 + 1000).ok).toBe(true)
  })

  it('forgets closed windows first when it holds too many keys', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 })

    limiter.take('old', T0)
    limiter.take('open', T0 + 900)
    // 'old' has closed; making room for 'new' forgets it and keeps 'open'.
    limiter.take('new', T0 + 1500)
    expect(limiter.take('open', T0 + 1500).ok).toBe(false)
  })

  it('stays bounded when every window is still open, forgetting the oldest', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 2 })

    limiter.take('a', T0)
    limiter.take('b', T0 + 1)
    limiter.take('c', T0 + 2)
    // 'a' was forgotten to make room, so it starts over; 'c' is still counted.
    expect(limiter.take('c', T0 + 3).ok).toBe(false)
    expect(limiter.take('a', T0 + 3).ok).toBe(true)
  })
})
