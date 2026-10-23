import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeaderMark } from '../HeaderMark'
import { MARK_PATHS, MARK_SMALL_PATHS } from '@/lib/brandMark'

const paths = () => [...screen.getByTestId('header-mark').querySelectorAll('path')].map((p) => p.getAttribute('d'))

describe('HeaderMark', () => {
  it('draws the v5.2 mark, as the app icon does', () => {
    render(<HeaderMark size={44} />)
    expect(paths()).toEqual(MARK_PATHS)
  })

  it('takes the small form at 24 px and under', () => {
    render(<HeaderMark size={20} />)
    expect(paths()).toEqual(MARK_SMALL_PATHS)
  })
})
