import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * iOS 26 blurs what sits under the topmost fixed element touching the top
 * edge, and keeps the tallest such zone it has seen: only the shell's two may
 * touch it. jsdom has no layout, so this reads the source.
 */
const SRC = path.resolve(__dirname, '../../..')

const LIGHT_OR_STUCK = ':is(html:not(.dark), html:has(main [data-testid="sticky-bar"][data-stuck]))'

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

  // iOS 26 draws no blur of its own over the page top only if WebKit finds,
  // 4 px inside the top edge, a fixed box at least 90 % of the viewport wide,
  // over 10 px tall, with a solid background-color
  // (LocalFrameView::fixedContainerEdges).
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
    expect(css).not.toMatch(/\[data-bar-shown\][^{]*\.edge-sampler/)
  })

  it("grows the scroll edge by a stuck strip, its fade still the last 30 pt", () => {
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    const start = css.indexOf('.scroll-edge {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('--edge-base: calc(var(--safe-top) + var(--bar-h) + var(--edge-fade))')
    expect(rule).toContain('--edge-shift: var(--sticky-h, 0px)')
    expect(rule).toContain('height: calc(var(--edge-base) + var(--edge-shift))')
    expect(css).toMatch(/--bar-h:\s+68px/)
    expect(css).toMatch(/--edge-fade:\s+30px/)
    for (const n of [1, 2, 3, 4]) {
      const at = css.indexOf(`.scroll-edge > i:nth-child(${n}) {`)
      const layer = css.slice(at, css.indexOf('}', at))
      // A bare percentage of the whole edge would start the fade under the bar.
      expect(layer).toContain('calc(var(--edge-shift) + var(--edge-base) *')
      expect(layer).not.toMatch(/(#000|transparent\)?) \d+%/)
    }
  })

  it("draws light's edge solid to the bar's foot, blurred only in its 24 pt fade", () => {
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    const rule = (selector: string) => {
      selector = selector.replaceAll('LIGHT_OR_STUCK', LIGHT_OR_STUCK)
      const at = css.indexOf(`${selector} {`)
      expect(at, selector).toBeGreaterThan(-1)
      return css.slice(at, css.indexOf('}', at))
    }
    expect(css).toMatch(/--edge-band:\s+24px/)
    const edge = rule('LIGHT_OR_STUCK .scroll-edge')
    expect(edge).toContain('--edge-base: calc(var(--safe-top) + var(--bar-h) + var(--edge-band))')
    expect(edge).toContain('--edge-solid: calc(var(--edge-shift) + var(--safe-top) + var(--bar-h))')
    const blur = rule('LIGHT_OR_STUCK .scroll-edge > i:nth-child(1)')
    expect(blur).toContain('backdrop-filter: blur(6px)')
    expect(blur).toContain('mask-image: linear-gradient(transparent var(--edge-solid), #000 var(--edge-solid), transparent)')
    expect(rule('LIGHT_OR_STUCK .scroll-edge > i:nth-child(2),\n  LIGHT_OR_STUCK .scroll-edge > i:nth-child(3)')).toContain('display: none')
    expect(rule('LIGHT_OR_STUCK .scroll-edge > i:nth-child(4)')).toContain('background: linear-gradient(var(--background) var(--edge-solid), transparent)')
  })

  it("gives dark light's edge while a glass strip is stuck", () => {
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    expect(css).toContain(`${LIGHT_OR_STUCK} .scroll-edge {`)
    expect(LIGHT_OR_STUCK).toContain('[data-stuck]')
    const bar = readFileSync(path.join(SRC, 'components/ui/StickyBar.tsx'), 'utf8')
    expect(bar).toContain("data-stuck={stuck ? '' : undefined}")
    expect(bar).toContain('data-testid="sticky-bar"')
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
