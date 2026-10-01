import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { fr } from '../fr'

type Node = Record<string, unknown>

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

  it('fr carries no key en has dropped', () => {
    expect(f.filter((p) => !inEn.has(p))).toEqual([])
  })
})

describe('French week streaks', () => {
  it('reads one week in the singular', () => {
    expect(fr.dashboard.weeklyStreak.weeksInARow(1)).toBe('1 semaine d’affilée')
    expect(fr.dashboard.weeklyStreak.weeksInARow(3)).toBe('3 semaines d’affilée')
    expect(fr.profile.milestones.streak(1)).toBe('1 semaine d’affilée')
  })
})

describe('French coach copy', () => {
  function strings(node: unknown): string[] {
    if (typeof node === 'string') return [node]
    if (typeof node === 'function') return [String((node as (...args: string[]) => string)('KIND', 'WHEN'))]
    if (node && typeof node === 'object') return Object.values(node).flatMap(strings)
    return []
  }

  // The app is not told who reads it: « tu es frais » is wrong for half its athletes.
  it('agrees nothing with the athlete', () => {
    const gendered = /\btu es (?:frais|fraîche|fatigué|fatiguée|prêt|prête|reposé|reposée)\b|\bt[’']es (?:entraîné|préparé)/i
    const copy = [...strings(fr.dashboard.todayHero.verdict), ...strings(fr.notifications)]
    expect(copy.filter((line) => gendered.test(line))).toEqual([])
  })
})
