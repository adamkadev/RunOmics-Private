import { describe, expect, it } from 'vitest'
import { simplifyTrack } from '../simplifyTrack'

describe('simplifyTrack', () => {
  it('drops points within the tolerance of the line kept, and keeps a corner and both ends', () => {
    const straight = Array.from({ length: 50 }, (_, i): [number, number] => [6 + i * 1e-5, 49 + (i % 2) * 1e-5])
    const corner: [number, number][] = [...straight, [6.0005, 49.001]]

    expect(simplifyTrack(straight, 3)).toEqual([straight[0], straight[49]])
    expect(simplifyTrack(corner, 3)).toEqual([straight[0], straight[49], [6.0005, 49.001]])
  })
})
