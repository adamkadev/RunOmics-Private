import { useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isStuck, restingTop, useStuck } from '../useStuck'

let scrollY = 0

/** A strip sticky at 99 pt, drawn at `top`, after a card ending at `cardBottom`. */
function layout(top: number, cardBottom = 300) {
  document.body.innerHTML = '<div style="row-gap: 14px"><section></section><div id="strip" style="top: 99px"></div></div>'
  const strip = document.getElementById('strip')!
  strip.getBoundingClientRect = () => ({ top }) as DOMRect
  document.querySelector('section')!.getBoundingClientRect = () => ({ bottom: cardBottom }) as DOMRect
  return strip
}

describe('a sticky strip', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  })
  afterEach(() => {
    scrollY = 0
    document.body.innerHTML = ''
  })

  it('is stuck once the scroll holds it at its offset', () => {
    scrollY = 400
    expect(isStuck(layout(99))).toBe(true)
    expect(isStuck(layout(150))).toBe(false)
    // At the top of the page it is where it is, not held there.
    scrollY = 0
    expect(isStuck(layout(99))).toBe(false)
  })

  it('rests after the card before it and the gap', () => {
    scrollY = 200
    expect(restingTop(layout(99, 300))).toBe(300 + 14 + 200)
  })

  it('is followed on scroll', async () => {
    function Strip() {
      const ref = useRef<HTMLDivElement>(null)
      const stuck = useStuck(ref)
      return <div ref={ref} style={{ top: 99 }} data-testid="strip" data-stuck={stuck || undefined} />
    }
    render(<Strip />)
    const strip = screen.getByTestId('strip')
    let top = 300
    strip.getBoundingClientRect = () => ({ top }) as DOMRect
    const scrollTo = async (y: number, at: number) => {
      scrollY = y
      top = at
      window.dispatchEvent(new Event('scroll'))
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      })
    }

    await scrollTo(150, 150)
    expect(strip.hasAttribute('data-stuck')).toBe(false)
    await scrollTo(400, 99)
    expect(strip.hasAttribute('data-stuck')).toBe(true)
    await scrollTo(0, 300)
    expect(strip.hasAttribute('data-stuck')).toBe(false)
  })
})
