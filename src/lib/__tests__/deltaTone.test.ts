import { describe, expect, it } from 'vitest'
import { DELTA_TONE_COLOR, deltaColor, deltaTone } from '../deltaTone'

describe('deltaTone (v4.7)', () => {
  it('reads each metric by which way is better', () => {
    expect(deltaTone('fitness', 6)).toBe('good')
    expect(deltaTone('fitness', -3)).toBe('worse')
    // Fatigue falling is the good news: a green down arrow.
    expect(deltaTone('fatigue', -4)).toBe('good')
    expect(deltaTone('fatigue', 38)).toBe('worse')
    expect(deltaTone('vo2max', -1)).toBe('worse')
    expect(deltaTone('pace', -28)).toBe('good')
    expect(deltaTone('pace', 9)).toBe('worse')
    expect(deltaTone('efficiency', -0.03)).toBe('worse')
    expect(deltaTone('efficiency', 0.03)).toBe('good')
    expect(deltaTone('heartRate', -3)).toBe('good')
    expect(deltaTone('heartRate', 3)).toBe('worse')
  })

  it('calls a change under its threshold no change', () => {
    expect(deltaTone('fitness', 0.5)).toBe('flat')
    expect(deltaTone('fatigue', 1.5)).toBe('flat')
    expect(deltaTone('vo2max', 0.4)).toBe('flat')
    expect(deltaTone('pace', -1)).toBe('flat')
    expect(deltaTone('efficiency', 0.005)).toBe('flat')
    // Up to 0.02 as printed, so -0.015 (printed -0.02) is noise too.
    expect(deltaTone('efficiency', -0.02)).toBe('flat')
    expect(deltaTone('efficiency', -0.015)).toBe('flat')
    expect(deltaTone('heartRate', 1.5)).toBe('flat')
    expect(deltaTone('heartRate', -1.2, { flatBelow: 1 })).toBe('good')
    // A race time: level only when it prints as 0 s; 2% of last year's distance.
    expect(deltaTone('race', 0.4, { value: 2570 })).toBe('flat')
    expect(deltaTone('race', 61, { value: 1224 })).toBe('worse')
    expect(deltaTone('race', -30, { value: 2400 })).toBe('good')
    expect(deltaTone('distance', 10, { value: 1394 })).toBe('flat')
    expect(deltaTone('distance', 754, { value: 1394 })).toBe('good')
    expect(deltaTone(null as unknown as 'fitness', null)).toBe('flat')
  })

  it('reads any slower race time as worse, however small', () => {
    expect(deltaTone('race', 8, { value: 2552 })).toBe('worse')
    expect(deltaTone('race', 1, { value: 12765 })).toBe('worse')
    expect(deltaTone('race', -1, { value: 12765 })).toBe('good')
    expect(deltaColor('race', 8, { value: 2552 })).toBe('var(--tone-caution)')
  })

  it('reads Form by whether it moved toward the neutral band', () => {
    expect(deltaTone('form', 10, { value: -7 })).toBe('good') // -17 → -7
    expect(deltaTone('form', -10, { value: -18 })).toBe('worse') // -8 → -18
    expect(deltaTone('form', 6, { value: 2 })).toBe('flat') // inside the band both times
    expect(deltaTone('form', 10, { value: 20 })).toBe('worse') // +10 → +20, further out
  })

  it('reads the load markers by their safe range', () => {
    expect(deltaTone('loadRatio', 0.2, { value: 1.13 })).toBe('flat')
    expect(deltaTone('loadRatio', 0.3, { value: 1.45 })).toBe('worse')
    expect(deltaTone('rampRate', 1, { value: 6 })).toBe('worse')
  })

  it('maps tones to --good, amber and muted - never the accent', () => {
    expect(DELTA_TONE_COLOR).toEqual({ good: 'var(--good)', worse: 'var(--tone-caution)', flat: 'var(--muted-foreground)' })
    expect(deltaColor('fitness', 6)).toBe('var(--good)')
    expect(Object.values(DELTA_TONE_COLOR).join()).not.toContain('accent')
  })
})
