import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChartScrub } from '../AnalyticsKit'

function setup() {
  const onShift = vi.fn()
  render(
    <ChartScrub count={4} onShift={onShift} readout={(i) => `week ${i + 1}`}>
      <div style={{ height: 100 }} />
    </ChartScrub>,
  )
  const el = document.querySelector<HTMLElement>('[data-chart-scrub]')!
  el.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 100, right: 400, bottom: 100 }) as DOMRect
  return { el, onShift }
}

const touch = (x: number, y = 50) => ({ pointerType: 'touch', clientX: x, clientY: y })

describe('ChartScrub (v4.5)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a hairline and a value chip on press and hold, and drops them on release', () => {
    const { el } = setup()
    fireEvent.pointerDown(el, touch(250))
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByRole('status').textContent).toBe('week 3')
    expect(screen.getByTestId('scrub-hairline')).toBeInTheDocument()
    fireEvent.pointerMove(el, touch(20))
    expect(screen.getByRole('status').textContent).toBe('week 1')
    fireEvent.pointerUp(el, touch(20))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('moves the window back on a swipe right, forward on a swipe left, and not on a tap', () => {
    const { el, onShift } = setup()
    fireEvent.pointerDown(el, touch(300))
    fireEvent.pointerMove(el, touch(200))
    fireEvent.pointerUp(el, touch(200))
    expect(onShift).toHaveBeenLastCalledWith(-1)
    fireEvent.pointerDown(el, touch(100))
    fireEvent.pointerMove(el, touch(220))
    fireEvent.pointerUp(el, touch(220))
    expect(onShift).toHaveBeenLastCalledWith(1)
    fireEvent.pointerDown(el, touch(100))
    fireEvent.pointerUp(el, touch(102))
    expect(onShift).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
