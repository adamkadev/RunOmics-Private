import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Set at runtime: next/font, the Aura and components' inline styles.
const RUNTIME = new Set(['--font-geist', '--aura-1', '--aura-2', '--aura-3', '--row-inset', '--row-thumb-inset', '--sticky-h'])

describe('globals.css variables', () => {
  it('defines every variable it reads, so a token regeneration cannot drop one in use', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const missing = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))].filter((name) => !defined.has(name) && !RUNTIME.has(name))

    expect(missing).toEqual([])
  })
})
