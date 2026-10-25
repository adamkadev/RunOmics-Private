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
    const copy = [...strings(fr.dashboard), ...strings(fr.notifications)]
    expect(copy.filter((line) => gendered.test(line))).toEqual([])
  })
})

describe('French plurals', () => {
  // French counts 0 and 1 in the singular: « 0 sortie », « 1 sortie », « 2 sorties ».
  it('start at two', () => {
    expect(fr.activities.countWithDistance(0, '0')).toBe('0 sortie · 0 km')
    expect(fr.activities.countWithDistance(1, '5')).toBe('1 sortie · 5 km')
    expect(fr.activities.countWithDistance(2, '10')).toBe('2 sorties · 10 km')
  })
})

describe('French design review copy', () => {
  it('writes the plan phase card, the week line and the race tile', () => {
    expect(fr.plan.phase.raceInWeeks('Semi', 29)).toBe('Semi dans 29 sem.')
    expect(fr.plan.phase.raceInDays('Semi', 0)).toBe('Semi aujourd’hui')
    expect(fr.plan.restCard.next('mar.')).toBe('Prochaine : mar.')
    expect(fr.profile.hub.inDays(1)).toBe('demain')
    expect(fr.profile.hub.inDays(155)).toBe('dans 155 jours')
  })

  it('writes the shoe projection on one line', () => {
    expect(fr.shoes.detail.projectedRunOut(25, '1 000', 'janv. 27', 11)).toBe('1 000 km ≈ janv. 27 · 11 sem. à 25 km/sem.')
  })
})

// CTL, ATL, ACWR and TSB mean nothing to most runners.
describe('the readiness card, in plain words', () => {
  it('names the numbers without acronyms', () => {
    for (const r of [en.dashboard.readiness, fr.dashboard.readiness]) {
      for (const label of [r.formLabel, r.ctl, r.atl]) expect(label).not.toMatch(/CTL|ATL|ACWR|TSB/)
    }
  })
})
