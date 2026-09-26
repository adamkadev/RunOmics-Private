import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * v4.8: iOS 26 takes the topmost fixed element that touches the top edge as
 * the page's bar, blurs what sits under it, and keeps the zone of the tallest
 * one it has seen. The compact title bar (safe area + 44 pt) and the
 * fullscreen maps touched the edge and left that zone over the large title -
 * the Analytics and Activity title blur. So one element touches it, the
 * status strip, and every other fixed element starts under it.
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
  it('is touched by the status strip alone', () => {
    const offenders: string[] = []
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8')
      text.split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
        if (TOP_PINNED.test(line) || STYLE_PINNED.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}`)
      })
    }
    expect(offenders).toEqual(['components/layout/AppShell.tsx:' + stripLine()])
  })

  it('keeps the strip exactly the status bar tall, opaque and on top', () => {
    const shell = readFileSync(path.join(SRC, 'components/layout/AppShell.tsx'), 'utf8')
    const strip = shell.slice(shell.indexOf('data-testid="status-strip"'), shell.indexOf('/>', shell.indexOf('data-testid="status-strip"')))
    expect(strip).toContain("height: 'var(--safe-top)'")
    expect(strip).toContain("background: 'var(--status-bar)'")
    expect(strip).toContain('z-[10000]')
  })

  it('starts the compact title bar under the strip', () => {
    const bar = readFileSync(path.join(SRC, 'components/layout/CompactTitleBar.tsx'), 'utf8')
    expect(bar).toContain("top: 'var(--safe-top)'")
    expect(bar).not.toContain("paddingTop: 'var(--safe-top)'")
  })
})

function stripLine(): number {
  const lines = readFileSync(path.join(SRC, 'components/layout/AppShell.tsx'), 'utf8').split('\n')
  return lines.findIndex((l) => TOP_PINNED.test(l)) + 1
}
