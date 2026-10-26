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

describe('French copy', () => {
  const SAMPLES: unknown[] = ['Sample', 'Autre', 1, 2, 0, -1, true, false, null, ['Sample', 'Autre'], { name: 'Sample' }]

  function tryCall(fn: (...args: unknown[]) => unknown, sample: unknown): unknown {
    try {
      return fn(...Array.from({ length: Math.max(fn.length, 1) + 2 }, () => sample))
    } catch {
      return null
    }
  }

  function strings(node: unknown, out: string[] = [], depth = 0): string[] {
    if (typeof node === 'string') out.push(node)
    else if (typeof node === 'function' && depth < 3) for (const sample of SAMPLES) strings(tryCall(node as (...args: unknown[]) => unknown, sample), out, depth + 1)
    else if (Array.isArray(node)) for (const value of node) strings(value, out, depth)
    else if (node && typeof node === 'object') for (const value of Object.values(node)) strings(value, out, depth)
    return out
  }

  const WORD_END = '(?![a-zàâäçéèêëîïôöûùüÿœæ])'
  const MASCULINE = '(?:frais|fatigué|prêt|reposé|récupéré|entraîné|préparé|motivé|seul|dernier|premier|content|sûr)'
  const GENDERED = [
    new RegExp(`\\btu (?:es|étais|seras|restes|parais|sembles) (?:bien |déjà |encore )?${MASCULINE}${WORD_END}`, 'i'),
    new RegExp(`\\bt[’']es (?:bien |déjà |encore )?(?:entraîné|préparé|reposé|récupéré|amélioré|rapproché)${WORD_END}`, 'i'),
    new RegExp(`\\bbien (?:récupéré|reposé|préparé|entraîné)${WORD_END}`, 'i'),
    /\btu es le (?:plus|moins) \w+/i,
    new RegExp(`^(?:Fatigué|Frais|Très frais|Reposé|Prêt|Récupéré|Entraîné)\\.?$`),
  ]

  it('agrees nothing with the athlete, anywhere in the tree', () => {
    const copy = strings(fr)

    expect(copy.filter((line) => GENDERED.some((pattern) => pattern.test(line)))).toEqual([])
  })

  it('reads the whole tree, not a corner of it', () => {
    expect(strings(fr).length).toBeGreaterThan(2000)
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
