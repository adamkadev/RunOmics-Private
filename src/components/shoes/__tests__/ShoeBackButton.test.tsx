import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { shoeBackLink } from '../ShoeBackButton'

// Design review, Oct 2026: a pair opened from Shoes goes back to Shoes.
describe('shoeBackLink', () => {
  it('goes back to Shoes when opened from there', () => {
    expect(shoeBackLink('shoes')).toEqual({ label: t.pages.shoes.title, href: '/shoes' })
  })

  it('goes back to Progress otherwise', () => {
    expect(shoeBackLink(null)).toEqual({ label: t.shoes.detail.back, href: '/profile' })
    expect(shoeBackLink('activities')).toEqual({ label: t.shoes.detail.back, href: '/profile' })
  })
})
