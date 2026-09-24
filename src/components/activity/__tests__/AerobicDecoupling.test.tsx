import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MINUS } from '@/lib/formatters'
import { AerobicDecoupling } from '../AerobicDecoupling'

describe('AerobicDecoupling', () => {
  // A negative drift used to print with a hyphen, the one signed number on the
  // page that did not use the app's minus.
  it('signs a negative drift with a real minus', () => {
    render(<AerobicDecoupling decoupling={{ percent: -1.44, drift: 'stable' }} />)

    expect(screen.getByText(new RegExp(`^${MINUS}1\\.4%`))).toBeInTheDocument()
  })

  it('keeps one decimal on a whole-number drift', () => {
    render(<AerobicDecoupling decoupling={{ percent: 6, drift: 'drifting' }} />)

    expect(screen.getByText(/^\+6\.0%/)).toBeInTheDocument()
  })
})
