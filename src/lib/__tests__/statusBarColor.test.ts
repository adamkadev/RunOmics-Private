import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATUS_BAR_COLOR, TOKEN_BLOCKS } from '@/lib/themeTokens'

/** iOS fills the installed app's opaque status bar from the theme-color meta: any colour but --background shows as a band. */
const css = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8')

function generated(marker: string, token: string): string | undefined {
  const at = css.indexOf(marker)
  const block = css.slice(at, css.indexOf('\n}', at))
  return block.match(new RegExp(`^\\s*${token}:\\s+([^;]+);`, 'm'))?.[1]
}

describe('the status bar colour (F15)', () => {
  it('is the page background, in both modes', () => {
    expect(STATUS_BAR_COLOR.light).toBe(generated('Light tokens - Teal (default)', '--background'))
    expect(STATUS_BAR_COLOR.dark).toBe(generated('\n.dark {', '--background'))
  })

  it('is the background under every accent: no accent block sets one of its own', () => {
    const setters = TOKEN_BLOCKS.filter((block) => '--background' in block.tokens).map((block) => block.selector)
    expect(setters).toEqual([':root', '.dark'])
  })

  it('is what the layout gives the two theme-color metas, split by prefers-color-scheme', () => {
    const layout = readFileSync(path.resolve(__dirname, '../../app/layout.tsx'), 'utf8')
    expect(layout).toContain("{ media: '(prefers-color-scheme: light)', color: STATUS_BAR_COLOR.light }")
    expect(layout).toContain("{ media: '(prefers-color-scheme: dark)', color: STATUS_BAR_COLOR.dark }")
    expect(layout).toContain("viewportFit: 'cover'")
    expect(layout).toContain("'apple-mobile-web-app-capable': 'yes'")
  })

  // One status-bar style serves both themes, read once at install, and black-translucent draws a white
  // clock, unreadable on the light Aura.
  it("keeps the opaque 'default' status bar in both themes", () => {
    const layout = readFileSync(path.resolve(__dirname, '../../app/layout.tsx'), 'utf8')
    expect(layout).toContain("statusBarStyle: 'default',")
    expect(layout).not.toMatch(/statusBarStyle: ['"]black/)
    expect(layout).not.toContain('apple-mobile-web-app-status-bar-style')
  })

  it('runs on into the overscroll: html and body paint the same background', () => {
    const rule = css.slice(css.indexOf('html,\nbody {'), css.indexOf('}', css.indexOf('html,\nbody {')))
    expect(rule).toContain('background-color: var(--background)')
  })
})
