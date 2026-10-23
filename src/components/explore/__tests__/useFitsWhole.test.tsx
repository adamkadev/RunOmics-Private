import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFitsWhole } from '../useFitsWhole'

/** The row's width in px; each character of the text 10 px - jsdom lays nothing out. */
let rowWidth = 100
function measure() {
  const scroll = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return (this.textContent?.length ?? 0) * 10
  })
  const client = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => rowWidth)
  return () => {
    scroll.mockRestore()
    client.mockRestore()
  }
}

function Line({ long, short }: { long: string; short: string }) {
  const { textRef, whole } = useFitsWhole<HTMLSpanElement>(long)
  return (
    <div>
      <span ref={textRef} data-testid="line">
        {whole ? long : short}
      </span>
    </div>
  )
}

describe('useFitsWhole', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    rowWidth = 100
  })

  it('keeps the text whole where it fits, and asks for the shorter one where it would be cut', () => {
    const restore = measure()
    try {
      const { rerender } = render(<Line long="ten chars!" short="short" />)
      expect(screen.getByTestId('line')).toHaveTextContent('ten chars!')
      rerender(<Line long="eleven chars" short="short" />)
      expect(screen.getByTestId('line')).toHaveTextContent('short')
      // A new text is measured again: whole, as it fits.
      rerender(<Line long="nine char" short="short" />)
      expect(screen.getByTestId('line')).toHaveTextContent('nine char')
    } finally {
      restore()
    }
  })

  it('tries the whole text again when its row changes width', () => {
    let resized: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    const restore = measure()
    try {
      render(<Line long="eleven chars" short="short" />)
      expect(screen.getByTestId('line')).toHaveTextContent('short')
      rowWidth = 200
      act(() => resized?.())
      expect(screen.getByTestId('line')).toHaveTextContent('eleven chars')
    } finally {
      restore()
    }
  })
})
