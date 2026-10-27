import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { swipeDirection, useSwipeNavigation, type SwipeBounds } from '../useSwipeNavigation'

function Pager({ onPrev, onNext, bounds, onTap }: { onPrev: () => void; onNext: () => void; bounds?: SwipeBounds; onTap?: () => void }) {
  const swipe = useSwipeNavigation(onPrev, onNext, bounds)
  return (
    <div data-testid="pager" {...swipe}>
      <button type="button" onClick={onTap}>day</button>
      <div data-testid="scroller" style={{ overflowX: 'auto' }}>
        <span data-testid="scrolled">wide</span>
      </div>
      <div className="maplibregl-map">
        <span data-testid="map">map</span>
      </div>
    </div>
  )
}

function setup(bounds?: SwipeBounds) {
  const onPrev = vi.fn()
  const onNext = vi.fn()
  const onTap = vi.fn()
  render(<Pager onPrev={onPrev} onNext={onNext} bounds={bounds} onTap={onTap} />)
  return { onPrev, onNext, onTap }
}

function touchSwipe(el: Element, dx: number, dy = 0) {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] })
  fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx / 2, clientY: 300 + dy / 2 }] })
  fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] })
}

function mouseSwipe(el: Element, dx: number, dy = 0) {
  fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX: 200, clientY: 300 })
  fireEvent.pointerUp(el, { pointerType: 'mouse', button: 0, clientX: 200 + dx, clientY: 300 + dy })
}

describe('swipeDirection', () => {
  it('needs more than 50 px across', () => {
    expect(swipeDirection(50, 0)).toBeNull()
    expect(swipeDirection(51, 0)).toBe('prev')
    expect(swipeDirection(-51, 0)).toBe('next')
  })

  it('needs the swipe to be more than one and a half times as wide as it is tall', () => {
    expect(swipeDirection(-90, 60)).toBeNull()
    expect(swipeDirection(-91, 60)).toBe('next')
    expect(swipeDirection(10, 200)).toBeNull()
  })
})

describe('useSwipeNavigation', () => {
  it('turns a left swipe into next and a right swipe into previous', () => {
    const { onPrev, onNext } = setup()
    touchSwipe(screen.getByTestId('pager'), -80)
    expect(onNext).toHaveBeenCalledTimes(1)
    touchSwipe(screen.getByTestId('pager'), 80)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('ignores a vertical scroll and a short swipe', () => {
    const { onPrev, onNext } = setup()
    touchSwipe(screen.getByTestId('pager'), 40, 220)
    touchSwipe(screen.getByTestId('pager'), 45)
    expect(onPrev).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('ignores a second finger', () => {
    const { onNext } = setup()
    const pager = screen.getByTestId('pager')
    fireEvent.touchStart(pager, { touches: [{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }] })
    fireEvent.touchEnd(pager, { touches: [], changedTouches: [{ clientX: 100, clientY: 300 }] })
    expect(onNext).not.toHaveBeenCalled()
  })

  it('stops at its bounds', () => {
    const { onPrev, onNext } = setup({ canPrev: false, canNext: false })
    touchSwipe(screen.getByTestId('pager'), 80)
    touchSwipe(screen.getByTestId('pager'), -80)
    expect(onPrev).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('leaves a swipe that starts on a map to the map', () => {
    const { onNext } = setup()
    touchSwipe(screen.getByTestId('map'), -80)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('leaves a swipe that starts on a horizontal scroller to the scroller', () => {
    const { onNext } = setup()
    const scroller = screen.getByTestId('scroller')
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 600 })
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
    touchSwipe(screen.getByTestId('scrolled'), -80)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('pages with a mouse drag, which does not also tap what it ends on', () => {
    const { onNext, onTap } = setup()
    const day = screen.getByRole('button', { name: 'day' })
    mouseSwipe(day, -80)
    fireEvent.click(day)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
    fireEvent.click(day)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('leaves touch pointers to the touch events', () => {
    const { onNext } = setup()
    const pager = screen.getByTestId('pager')
    fireEvent.pointerDown(pager, { pointerType: 'touch', clientX: 200, clientY: 300 })
    fireEvent.pointerUp(pager, { pointerType: 'touch', clientX: 100, clientY: 300 })
    expect(onNext).not.toHaveBeenCalled()
  })
})
