import { describe, it, expect } from 'vitest'
import { activeNavHref } from '../navigation'

const SIDEBAR = ['/', '/activities', '/plan', '/analytics', '/map', '/profile', '/settings']
const TAB_BAR = ['/', '/activities', '/plan', '/analytics', '/profile']

describe('activeNavHref', () => {
  it('lights up Today on the home route', () => {
    expect(activeNavHref('/', SIDEBAR)).toBe('/')
    expect(activeNavHref('/', TAB_BAR)).toBe('/')
  })

  it('keeps the section lit on detail pages', () => {
    expect(activeNavHref('/activities/12345', SIDEBAR)).toBe('/activities')
    expect(activeNavHref('/shoes/abc', TAB_BAR)).toBe('/profile')
  })

  it('folds the Progress sub-pages into Progress in both navs', () => {
    for (const path of ['/shoes', '/records', '/goals', '/athlete', '/milestones']) {
      expect(activeNavHref(path, SIDEBAR)).toBe('/profile')
      expect(activeNavHref(path, TAB_BAR)).toBe('/profile')
    }
  })

  it('prefers a nav entry of its own over the parent section', () => {
    expect(activeNavHref('/map', SIDEBAR)).toBe('/map')
    expect(activeNavHref('/map', TAB_BAR)).toBe('/activities')
    expect(activeNavHref('/settings', SIDEBAR)).toBe('/settings')
    expect(activeNavHref('/settings', TAB_BAR)).toBe('/profile')
  })

  it('lights up nothing on a route no nav owns', () => {
    expect(activeNavHref('/login', SIDEBAR)).toBeNull()
  })
})
