import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { useScrollLock } from '../useScrollLock'

function Sheet() {
  useScrollLock()
  return null
}

describe('an open sheet dims the status strip (v5.6 #3)', () => {
  it('flags the document while any sheet is open, and clears it after the last one', () => {
    const a = render(<Sheet />)
    const b = render(<Sheet />)
    expect(document.documentElement.hasAttribute('data-sheet-open')).toBe(true)
    a.unmount()
    expect(document.documentElement.hasAttribute('data-sheet-open')).toBe(true)
    b.unmount()
    expect(document.documentElement.hasAttribute('data-sheet-open')).toBe(false)
  })

  it('has the rule that dims the strip', () => {
    const css = readFileSync(path.join(__dirname, '../../app/globals.css'), 'utf8')
    expect(css).toMatch(/html\[data-sheet-open\] \.edge-sampler/)
  })

  // Dimmed whole, the strip's last 12 pt under the scrim would read as a dark band.
  it('dims only the part of the strip above the scrim, as the scrim does', () => {
    const css = readFileSync(path.join(__dirname, '../../app/globals.css'), 'utf8')
    const at = css.indexOf('html[data-sheet-open] .edge-sampler {')
    expect(css.slice(at, css.indexOf('}', at))).toContain('box-shadow: inset 0 var(--safe-top) 0 0 var(--scrim-sheet);')
  })
})

describe('the tab bar stacks above the sticky strips (v5.5 #2)', () => {
  it('sits higher than StickyBar, so the Overview control never paints over it', () => {
    const read = (file: string) => readFileSync(path.join(__dirname, '../../components', file), 'utf8')
    const z = (source: string, pattern: RegExp) => Number(source.match(pattern)?.[1])
    const tabBar = z(read('layout/GlassTabBar.tsx'), /fixed inset-x-0 bottom-0 z-(\d+)/)
    const sticky = z(read('ui/StickyBar.tsx'), /sticky z-(\d+)/)
    expect(tabBar).toBeGreaterThan(sticky)
  })
})
