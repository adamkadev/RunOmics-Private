import { describe, expect, it } from 'vitest'

describe('monthAxis', () => {
  it('keeps a tick on every month, shortened to its initial past six', async () => {
    const { monthAxis } = await import('../chartAxis')
    expect(monthAxis(9).interval).toBe(0)
    expect(monthAxis(9).tickFormatter('AUG')).toBe('A')
    expect(monthAxis(4).tickFormatter('AUG')).toBe('AUG')
  })
})
