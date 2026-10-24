import { describe, expect, it } from 'vitest'
import { decodePolyline, decodeTracks, encodePolyline } from '../polyline'

const GOOGLE: [number, number][] = [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]

describe('polyline', () => {
  it('writes Google’s reference line, and reads it back', () => {
    expect(encodePolyline(GOOGLE)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(GOOGLE)
  })

  it('keeps a track to the metre, and passes plain arrays through', () => {
    const track: [number, number][] = [[6.1734567, 49.1198765], [6.1736012, 49.1201234], [6.1731111, 49.1199999]]
    const back = decodeTracks({ 3: encodePolyline(track), 4: track })
    back['3']!.forEach(([lon, lat], k) => {
      expect(lon).toBeCloseTo(track[k]![0], 5)
      expect(lat).toBeCloseTo(track[k]![1], 5)
    })
    expect(back['4']).toBe(track)
  })
})
