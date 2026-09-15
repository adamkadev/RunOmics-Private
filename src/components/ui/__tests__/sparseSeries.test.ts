import { describe, expect, it } from 'vitest'
import { sparseRow } from '@/components/ui/SparseSeries'

const bpm = (v: number) => `${Math.round(v)} bpm`

describe('sparseRow', () => {
  it('reports where the series started and where it ended', () => {
    expect(sparseRow('Easy', [150, 148, 145], bpm)).toEqual({
      label: 'Easy',
      first: '150 bpm',
      last: '145 bpm',
      change: '\u22125 bpm',
    })
  })

  it('uses a real minus sign, not a hyphen', () => {
    expect(sparseRow('Easy', [150, 145], bpm)?.change?.startsWith('\u2212')).toBe(true)
  })

  it('marks a rise with a plus', () => {
    expect(sparseRow('Easy', [145, 150], bpm)?.change).toBe('+5 bpm')
  })

  it('omits the change when only one reading exists', () => {
    expect(sparseRow('Easy', [150], bpm)?.change).toBeUndefined()
  })

  it('skips non-numeric entries rather than rendering them', () => {
    expect(sparseRow('Easy', [null, undefined, 'x', 150, 140], bpm)).toMatchObject({
      first: '150 bpm',
      last: '140 bpm',
    })
  })

  it('returns nothing when the series holds no readings', () => {
    expect(sparseRow('Easy', [null, undefined], bpm)).toBeNull()
  })
})
