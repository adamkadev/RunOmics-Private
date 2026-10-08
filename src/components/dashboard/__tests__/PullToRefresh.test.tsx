import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PullToRefresh, PULL_THRESHOLD_PX } from '../PullToRefresh'

function pull(dy: number, { dx = 0, from = window as Window | Element } = {}) {
  fireEvent.touchStart(from, { touches: [{ clientX: 100, clientY: 100 }] })
  fireEvent.touchMove(window, { touches: [{ clientX: 100 + dx, clientY: 100 + dy }] })
  fireEvent.touchEnd(window, { touches: [] })
}

// Design review, Oct 2026: pull down on Today does what a tap on the sync line does.
describe('PullToRefresh', () => {
  beforeEach(() => Object.defineProperty(window, 'scrollY', { value: 0, configurable: true }))
  afterEach(() => Object.defineProperty(window, 'scrollY', { value: 0, configurable: true }))

  it('starts the action on a pull past the threshold, from the top of the page', () => {
    const onPull = vi.fn()
    render(<PullToRefresh onPull={onPull} />)
    // The finger travels twice the indicator's distance.
    pull(PULL_THRESHOLD_PX * 2 + 10)
    expect(onPull).toHaveBeenCalledTimes(1)
  })

  it('lets a short pull go without doing anything', () => {
    const onPull = vi.fn()
    render(<PullToRefresh onPull={onPull} />)
    pull(PULL_THRESHOLD_PX)
    expect(onPull).not.toHaveBeenCalled()
  })

  it('ignores a pull anywhere but the top, a sideways swipe, and a sheet', () => {
    const onPull = vi.fn()
    render(
      <>
        <PullToRefresh onPull={onPull} />
        <div role="dialog">
          <p>sheet</p>
        </div>
      </>
    )
    pull(400, { dx: 500 })
    pull(400, { from: screen.getByText('sheet') })
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true })
    pull(400)
    expect(onPull).not.toHaveBeenCalled()
  })

  it('does nothing while the action is unavailable', () => {
    const onPull = vi.fn()
    render(<PullToRefresh onPull={onPull} disabled />)
    pull(400)
    expect(onPull).not.toHaveBeenCalled()
  })

  it('shows how far the pull has gone, and when letting go will start it', () => {
    render(<PullToRefresh onPull={() => {}} />)
    const indicator = screen.getByTestId('pull-indicator')
    fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(window, { touches: [{ clientX: 100, clientY: 140 }] })
    expect(indicator.dataset.armed).toBe('false')
    expect(Number(indicator.style.opacity)).toBeGreaterThan(0)
    fireEvent.touchMove(window, { touches: [{ clientX: 100, clientY: 100 + PULL_THRESHOLD_PX * 2 }] })
    expect(indicator.dataset.armed).toBe('true')
    fireEvent.touchEnd(window, { touches: [] })
    expect(indicator.style.opacity).toBe('0')
  })
})
