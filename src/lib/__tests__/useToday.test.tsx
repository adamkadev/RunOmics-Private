import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToday } from '../useToday'
import { hydrateAcrossMidnight } from './hydrateAcrossMidnight'

function Today({ serverToday }: { serverToday: string }) {
  return <span>{useToday(serverToday)}</span>
}

const BUILT = new Date(2026, 8, 23, 23, 50)
const OPENED = new Date(2026, 8, 24, 0, 10)

describe('useToday', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it("hydrates on the page's own date, then moves to the reader's", async () => {
    const { html, container, recoverableErrors } = await hydrateAcrossMidnight(<Today serverToday="2026-09-23" />, {
      serverTime: BUILT,
      clientTime: OPENED,
    })

    expect(html).toContain('2026-09-23')
    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toBe('2026-09-24')
  })

  it('rolls over at midnight while the page stays open', async () => {
    const { container } = await hydrateAcrossMidnight(<Today serverToday="2026-09-23" />, {
      serverTime: BUILT,
      clientTime: BUILT,
    })
    expect(container.textContent).toBe('2026-09-23')

    await act(async () => {
      vi.setSystemTime(OPENED)
      vi.advanceTimersByTime(60_000)
    })
    expect(container.textContent).toBe('2026-09-24')
  })
})
