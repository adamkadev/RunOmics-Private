import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { fr } from '../fr'

type Node = Record<string, unknown>

/**
 * Every leaf of a locale, as `path:type`. The type is part of the key because
 * the shapes have to match too: a plain string where the other locale holds an
 * interpolating function renders "[object Object]" at the callsite, and
 * `satisfies Strings` only checks fr against en - it says nothing about keys fr
 * carries that en has since dropped.
 */
function paths(obj: Node, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...paths(v as Node, p))
    else out.push(`${p}:${Array.isArray(v) ? 'array' : typeof v}`)
  }
  return out.sort()
}

describe('i18n parity', () => {
  const e = paths(en as unknown as Node)
  const f = paths(fr as unknown as Node)
  const inEn = new Set(e)
  const inFr = new Set(f)

  it('fr translates every key en defines', () => {
    expect(e.filter((p) => !inFr.has(p))).toEqual([])
  })

  // Catches the other half: copy removed from en but left behind in fr, which
  // no type check flags and which quietly rots.
  it('fr carries no key en has dropped', () => {
    expect(f.filter((p) => !inEn.has(p))).toEqual([])
  })
})
