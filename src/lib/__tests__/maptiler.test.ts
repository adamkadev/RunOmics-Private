import { describe, it, expect } from 'vitest'
import { maptilerStyleUrl } from '../maptiler'

describe('maptilerStyleUrl', () => {
  it('draws the dark backdrop on dark, whichever light style is asked for', () => {
    expect(maptilerStyleUrl(true, 'k')).toContain('/maps/backdrop-v4-dark/')
    expect(maptilerStyleUrl(true, 'k', { grey: true })).toContain('/maps/backdrop-v4-dark/')
  })

  it('keeps the dataviz style on light unless a grey basemap is asked for (v4.17)', () => {
    expect(maptilerStyleUrl(false, 'k')).toContain('/maps/dataviz-v4/')
    expect(maptilerStyleUrl(false, 'k', { grey: true })).toContain('/maps/backdrop-v4-light/')
  })
})
