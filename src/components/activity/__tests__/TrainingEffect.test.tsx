import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrainingEffect } from '../TrainingEffect'

describe('TrainingEffect', () => {
  it('shows both readings, because a run scores on both axes', () => {
    render(<TrainingEffect aer={3.4} ana={2.1} />)

    expect(screen.getByText('3.4')).toBeInTheDocument()
    expect(screen.getByText('2.1')).toBeInTheDocument()
    expect(screen.getByText('Improving')).toBeInTheDocument()
    expect(screen.getByText('Maintaining')).toBeInTheDocument()
  })

  it('keeps a 0.0 reading on screen instead of dropping the cell', () => {
    render(<TrainingEffect aer={3.4} ana={0} />)

    expect(screen.getByText('0.0')).toBeInTheDocument()
    expect(screen.getByText('No benefit')).toBeInTheDocument()
  })

  it('colours an earned effect good and mutes "no benefit"', () => {
    render(<TrainingEffect aer={3.4} ana={0} />)

    expect(screen.getByText('3.4').className).toContain('text-emerald-600')
    expect(screen.getByText('0.0').className).toContain('text-muted-foreground')
    expect(screen.getByText('0.0').className).not.toContain('emerald')
  })

  it('renders nothing when the device reported neither', () => {
    const { container } = render(<TrainingEffect aer={null} ana={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
