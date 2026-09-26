import { describe, expect, it } from 'vitest'
import { displayTitle } from '../title'

describe('displayTitle', () => {
  it('writes a rep count with ×', () => {
    expect(displayTitle('Threshold 3 x 7:00')).toBe('Threshold 3 × 7:00')
    expect(displayTitle('6x200m')).toBe('6 × 200m')
    expect(displayTitle('Easy 51 min + 6 × 20s strides')).toBe('Easy 51 min + 6 × 20s strides')
  })

  it('leaves words with an x alone', () => {
    expect(displayTitle('Max effort box run')).toBe('Max effort box run')
  })
})
