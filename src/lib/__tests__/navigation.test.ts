import { describe, it, expect } from 'vitest'
import { activeNavHref, findOrigin, sectionLabel } from '../navigation'
import { t } from '@/i18n'

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

describe('findOrigin', () => {
  it('returns nothing when the section was entered directly', () => {
    expect(findOrigin([], '/activities/123')).toBeNull()
  })

  it('points back at the page that opened the detail', () => {
    expect(findOrigin(['/profile', '/records'], '/activities/123')).toEqual({
      path: '/records',
      isImmediate: true,
    })
  })

  it('keeps the list as origin when walking between sibling details', () => {
    expect(findOrigin(['/profile', '/records', '/activities/1'], '/activities/2')).toEqual({
      path: '/records',
      isImmediate: false,
    })
  })

  it('treats a list and its detail as distinct steps', () => {
    expect(findOrigin(['/profile', '/shoes'], '/shoes/abc')).toEqual({
      path: '/shoes',
      isImmediate: true,
    })
  })
})

describe('sectionLabel', () => {
  it('names the section a path belongs to', () => {
    expect(sectionLabel('/records')).toBe(t.pages.records.title)
    expect(sectionLabel('/activities/123')).toBe(t.nav.items.activities)
    expect(sectionLabel('/')).toBe(t.nav.items.dashboard)
  })

  it('returns nothing for a path no section owns', () => {
    expect(sectionLabel('/login')).toBeNull()
  })
})
