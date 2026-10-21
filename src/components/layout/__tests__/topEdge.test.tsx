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

  // v4.8's single strip (the safe area tall, z-10000) left every title soft
  // on a device; these two, unchanged, were sharp.
  it('keeps the top edge as it was when the device showed it sharp', () => {
    const shell = readFileSync(path.join(SRC, 'components/layout/AppShell.tsx'), 'utf8')
    const block = (id: string) => shell.slice(shell.indexOf(`data-testid="${id}"`), shell.indexOf('/>', shell.indexOf(`data-testid="${id}"`)))
    expect(block('status-strip')).toContain("height: 'var(--top-scrim)'")
    expect(block('status-strip')).toContain("background: 'var(--status-bar)'")
    expect(block('status-strip')).toContain('z-20')
    expect(block('top-edge-bar')).toContain('h-12')
    expect(block('top-edge-bar')).toContain("background: 'var(--background)'")
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
