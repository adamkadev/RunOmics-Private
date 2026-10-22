import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StickyBar } from '../StickyBar'
import { tooltipSurfaceClass } from '../Card'

describe('StickyBar', () => {
  // G11: the sticky tabs had a translucent, blurred fill.
  it('is opaque, with a hairline, at the offset it is given', () => {
    render(<StickyBar top="12px">tabs</StickyBar>)
    const bar = screen.getByTestId('sticky-bar')
    expect(bar.className).toContain('bg-background')
    expect(bar.className).not.toMatch(/bg-background\/|backdrop-blur/)
    expect(bar.className).toContain('border-b')
    expect(bar.style.top).toBe('12px')
    // A phone's sticky strip is transparent over the soft scroll edge (Liquid Glass v2).
    expect(bar.className).toContain('max-lg:bg-transparent')
  })

  // F20: stuck, its control is glass and the rows pass visibly under it, so
  // the scroll edge must not grow by it and paint the ground behind the glass.
  it('does not grow the scroll edge by its height', () => {
    render(<StickyBar top="12px">tabs</StickyBar>)
    expect(screen.getByTestId('sticky-bar').hasAttribute('data-sticky-strip')).toBe(false)
  })
})

describe('tooltip surface', () => {
  // G12: dark tooltips used a 5 % wash.
  it('uses the opaque popover fill', () => {
    expect(tooltipSurfaceClass).toContain('bg-[var(--popover)]')
    expect(tooltipSurfaceClass).not.toContain('bg-muted')
  })
})
