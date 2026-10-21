import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * F15, landscape: with viewport-fit=cover the page runs under the notch's side
 * and the rounded corners. Backgrounds may; text and controls may not. jsdom
 * has no safe areas, so this reads the source; the shell, both bars and the
 * fullscreen maps' controls each add the side insets to their own margin.
 */
const SRC = path.resolve(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8')

describe('the side insets (F15)', () => {
  it('are tokens beside the top and bottom ones', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/--safe-left:\s+env\(safe-area-inset-left, 0px\);/)
    expect(css).toMatch(/--safe-right:\s+env\(safe-area-inset-right, 0px\);/)
  })

  it('pad the page column, the compact bar and the tab bar', () => {
    expect(read('components/layout/AppShell.tsx')).toContain('<main className="relative min-h-screen overflow-x-clip pl-[var(--safe-left)] pr-[var(--safe-right)]')
    const bar = read('components/layout/CompactTitleBar.tsx')
    expect(bar).toContain("paddingLeft: 'var(--safe-left)'")
    expect(bar).toContain("paddingRight: 'var(--safe-right)'")
    const tabs = read('components/layout/GlassTabBar.tsx')
    expect(tabs).toContain('pl-[calc(1.5rem+var(--safe-left))] pr-[calc(1.5rem+var(--safe-right))]')
    // The row's fixed width is the nav's, so the last tab stays inside the glass.
    expect(tabs).toContain('w-[calc(100vw_-_48px_-_var(--safe-left)_-_var(--safe-right))]')
  })

  it("keep both fullscreen maps' controls clear of the notch", () => {
    const heat = read('components/map/GlobalMapClient.tsx')
    expect(heat).toContain('left-[calc(1rem+var(--safe-left))] right-[calc(1rem+var(--safe-right))] top-3')
    expect(heat).toContain('left-[calc(1.5rem+var(--safe-left))] right-[calc(1.5rem+var(--safe-right))] bottom-')
    const run = read('components/activity/ActivityMap.tsx')
    expect(run).toContain('justify-between pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))]')
    expect(run).toContain('left-[calc(0.75rem+var(--safe-left))] right-[calc(0.75rem+var(--safe-right))] bottom-')
  })
})
