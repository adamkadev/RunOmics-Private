import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StickyBar } from '../StickyBar'
import { tooltipSurfaceClass } from '../Card'

describe('StickyBar', () => {
  it('is opaque, with a hairline, at the offset it is given', () => {
    render(<StickyBar top="12px">tabs</StickyBar>)
    const bar = screen.getByTestId('sticky-bar')
    expect(bar.className).toContain('bg-background')
    expect(bar.className).not.toMatch(/bg-background\/|backdrop-blur/)
    expect(bar.className).toContain('border-b')
    expect(bar.style.top).toBe('12px')
    expect(bar.className).toContain('max-lg:bg-transparent')
  })

  it('does not grow the scroll edge by its height', () => {
    render(<StickyBar top="12px">tabs</StickyBar>)
    expect(screen.getByTestId('sticky-bar').hasAttribute('data-sticky-strip')).toBe(false)
  })
})

describe('tooltip surface', () => {
  it('uses the opaque popover fill', () => {
    expect(tooltipSurfaceClass).toContain('bg-[var(--popover)]')
    expect(tooltipSurfaceClass).not.toContain('bg-muted')
  })
})
