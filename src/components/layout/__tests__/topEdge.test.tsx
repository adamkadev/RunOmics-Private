import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * v4.8: iOS 26 takes the topmost fixed element that touches the top edge as
 * the page's bar, blurs what sits under it, and keeps the zone of the tallest
 * one it has seen. The compact title bar (safe area + 44 pt) and the
 * fullscreen maps touched the edge and left that zone over the large title -
 * the Analytics and Activity title blur. So only the shell's own two touch
 * it - the status-bar scrim and the flat bar behind the page, as they were
 * when a device showed the title sharp - and every other fixed element
 * starts under the status bar.
 *
 * jsdom has no layout, so this reads the source: a fixed element pinned to
 * the top (inset-0, inset-y-0, top-0, or a style top of 0) anywhere but the
 * strip fails. The e2e layering spec checks the same rule in a browser.
 */
const SRC = path.resolve(__dirname, '../../..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full)
    return /\.(tsx|ts)$/.test(name) ? [full] : []
  })
}

const TOP_PINNED = /\bfixed\b[^"'`]*\b(inset-0|inset-y-0|top-0)\b|\b(inset-0|inset-y-0|top-0)\b[^"'`]*\bfixed\b/
const STYLE_PINNED = /position:\s*['"]fixed['"][^}]*\btop:\s*['"]?0(px)?['"]?\s*[,}]/

describe('the top edge (v4.8)', () => {
  it("is touched by the shell's own two alone", () => {
    const offenders: string[] = []
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8')
      text.split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
        if (TOP_PINNED.test(line) || STYLE_PINNED.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}`)
      })
    }
    expect(offenders).toEqual(shellLines().map((n) => `components/layout/AppShell.tsx:${n}`))
  })

  // Liquid Glass v2 (owner's brief, Oct 2026): iOS 26 draws no blur of its
  // own over the page top only if WebKit finds, 4 px inside the top edge, a
  // fixed box at least 90 % of the viewport wide, over 10 px tall, with a
  // solid background-color (LocalFrameView::fixedContainerEdges). The 4 px
  // status strip was too short, and a strip sized to the safe area (0 in the
  // installed app) vanished: both left every large title blurred at rest.
  it('keeps one solid edge sampler at the top, over 10 px tall, never resized', () => {
    const shell = readFileSync(path.join(SRC, 'components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toContain('data-testid="edge-sampler"')
    expect(shell).toContain('className="edge-sampler lg:hidden"')
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    const rule = css.slice(css.indexOf('.edge-sampler {'), css.indexOf('}', css.indexOf('.edge-sampler {')))
    expect(rule).toContain('position: fixed')
    expect(rule).toContain('top: 0')
    expect(rule).toContain('inset-inline: 0')
    expect(rule).toContain('height: calc(var(--safe-top) + var(--edge-sample-h))')
    expect(rule).toContain('background-color: var(--background)')
    expect(rule).not.toMatch(/backdrop-filter|opacity|transition/)
    expect(css).toMatch(/--edge-sample-h:\s+12px/)
    // Nothing turns it to glass, hides it or resizes it.
    expect(css).not.toMatch(/\[data-bar-shown\][^{]*\.edge-sampler/)
  })

  it('starts the compact title bar under the strip', () => {
    const bar = readFileSync(path.join(SRC, 'components/layout/CompactTitleBar.tsx'), 'utf8')
    expect(bar).toContain("top: 'var(--safe-top)'")
    expect(bar).not.toContain("paddingTop: 'var(--safe-top)'")
  })
})

function shellLines(): number[] {
  const lines = readFileSync(path.join(SRC, 'components/layout/AppShell.tsx'), 'utf8').split('\n')
  return lines.flatMap((l, i) => (TOP_PINNED.test(l) ? [i + 1] : []))
}
