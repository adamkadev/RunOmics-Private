import { describe, it, expect } from 'vitest'
import { shortShoeName } from '../shortName'

describe('shortShoeName', () => {
  it('drops the brand the row already shows a mark for', () => {
    expect(shortShoeName('Nike Vomero 17', 'Nike')).toBe('Vomero 17')
  })

  it('drops a model line that says nothing about the pair', () => {
    expect(shortShoeName('Adizero EVO SL', 'adidas')).toBe('EVO SL')
    expect(shortShoeName('Air Zoom Pegasus 40', 'Nike')).toBe('Pegasus 40')
  })

  it('keeps the generation, which is what separates two pairs of one model', () => {
    expect(shortShoeName('Nike Pegasus 40', 'Nike')).toBe('Pegasus 40')
    expect(shortShoeName('Nike Pegasus 41', 'Nike')).toBe('Pegasus 41')
  })

  it('never strips a name down to nothing', () => {
    expect(shortShoeName('Adizero', 'adidas')).toBe('Adizero')
    expect(shortShoeName('Nike', 'Nike')).toBe('Nike')
  })

  it('leaves a name that carries no prefix alone', () => {
    expect(shortShoeName('Cloudmonster', 'On')).toBe('Cloudmonster')
  })
})
