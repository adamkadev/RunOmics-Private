import { describe, expect, it } from 'vitest'
import { intendedType, sessionLabel } from '@/lib/activityTitle'

// Round 2, the owner's ask: where a type's dot or eyebrow is beside it, a
// session reads as its set, said once.
describe('sessionLabel', () => {
  it('drops the type a name leads with: the dot says it', () => {
    expect(sessionLabel('Threshold · 3 × 8′ @ 4:25')).toBe('3 × 8′ @ 4:25')
    expect(sessionLabel('Tempo · 20′ @ 4:40')).toBe('20′ @ 4:40')
    expect(sessionLabel('VO₂ max · 5 × 3′ @ 3:55')).toBe('5 × 3′ @ 3:55')
    expect(sessionLabel('Easy · 54 min + 6 strides')).toBe('54 min + 6 strides')
    expect(sessionLabel('Seuil · 3 × 8′ @ 4:20')).toBe('3 × 8′ @ 4:20')
  })

  // A name from before the naming rules (Oct 7) says its set twice: the
  // coach's, then Garmin's. Garmin's half is kept, the simpler one.
  it("keeps an older name's simpler half, in the rules' notation", () => {
    expect(sessionLabel("Threshold 3 x 7:15 - 3x7'@4:25")).toBe('3 × 7′ @ 4:25')
    expect(sessionLabel("Threshold 3 × 7:00 - 3 × 7'@4:25")).toBe('3 × 7′ @ 4:25')
    expect(sessionLabel("Threshold 2 × 7:00 - 2 × 7'@4:25")).toBe('2 × 7′ @ 4:25')
    expect(sessionLabel("Répétitions allure d'objectif - 4x3'@4:24")).toBe('4 × 3′ @ 4:24')
    expect(sessionLabel('Seuil - 3x8:00@4:20/km')).toBe('3 × 8′ @ 4:20')
  })

  it("writes a bare set from Garmin in the rules' notation", () => {
    expect(sessionLabel("3x8'@4:20")).toBe('3 × 8′ @ 4:20')
    expect(sessionLabel("4x3'30@4:10")).toBe('4 × 3′30″ @ 4:10')
  })

  it('keeps words that are not the type, after the set', () => {
    expect(sessionLabel('Strides 6 × 20s')).toBe('6 × 20s strides')
    expect(sessionLabel('Strides · 6 × 20″')).toBe('6 × 20″ strides')
    expect(sessionLabel('Easy 50 min + 6 × 20s strides')).toBe('50 min + 6 × 20s strides')
    expect(sessionLabel('Footing 50 min + 6 accélérations de 20s')).toBe('50 min + 6 accélérations de 20s')
  })

  it('keeps a name with no set whole', () => {
    for (const title of ['Easy run', 'Long run', 'Recovery run', 'Intervals', '5K Race', 'Morning Run 10 km', 'Wine Route - Luxemburg', '10K de Metz', 'Sunday Run']) {
      expect(sessionLabel(title)).toBe(title)
    }
  })
})

// Round 2, the owner's runs: Garmin files a run by how it went; its name says
// what it was set as, and that is the type it is shown as.
describe('intendedType', () => {
  it('reads the type a name leads with, over the watch\'s', () => {
    expect(intendedType({ type: 'Tempo', description: "Threshold 2 x 7:00 - 2x7'@4:25" })).toBe('Threshold')
    expect(intendedType({ type: 'Tempo', description: 'Base' })).toBe('Base')
    expect(intendedType({ type: 'Tempo', description: 'Seuil - 3x8\'@4:20' })).toBe('Threshold')
    expect(intendedType({ type: 'Threshold', description: 'Tempo · 20′ @ 4:40' })).toBe('Tempo')
    expect(intendedType({ type: 'Tempo', description: 'Easy · 54 min + 6 strides' })).toBe('Base')
    expect(intendedType({ type: 'Threshold', description: 'VO₂ max · 5 × 3′ @ 3:55' })).toBe('VO2Max')
  })

  it("keeps the watch's type where the name names none, or names no one type", () => {
    for (const description of ['Morning Run', '10K de Metz', 'Strides 6 × 20s', 'Intervals', 'Recovery Jog', '', undefined]) {
      expect(intendedType({ type: 'Tempo', description })).toBe('Tempo')
    }
  })
})
