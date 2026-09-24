import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from '../withTimeout'

afterEach(() => {
  vi.useRealTimers()
})

describe('withTimeout', () => {
  it('answers with the promise when it settles first, and leaves no timer behind', async () => {
    vi.useFakeTimers()

    await expect(withTimeout(Promise.resolve('read'), 10_000, null)).resolves.toBe('read')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('answers with the fallback when the promise is too slow', async () => {
    vi.useFakeTimers()
    const never = new Promise<string>(() => {})

    const raced = withTimeout(never, 2_000, null)
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(raced).resolves.toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('passes a rejection through, and still clears the timer', async () => {
    vi.useFakeTimers()

    await expect(withTimeout(Promise.reject(new Error('down')), 10_000, null)).rejects.toThrow('down')
    expect(vi.getTimerCount()).toBe(0)
  })
})
