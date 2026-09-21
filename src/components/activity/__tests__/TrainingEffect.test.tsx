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

  it('drops an axis the run did not score on, rather than spending half the row on a zero', () => {
    render(<TrainingEffect aer={3.4} ana={0} />)

    expect(screen.getByText('3.4')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).toBeNull()
    expect(screen.queryByText('No benefit')).toBeNull()
    expect(screen.queryByText('Anaerobic effect')).toBeNull()
  })

  it('colours a scored effect good', () => {
    render(<TrainingEffect aer={3.4} ana={2.1} />)

    expect(screen.getByText('3.4').className).toContain('text-emerald-600')
  })

  it('sets the qualifier in the same weight as the value it qualifies', () => {
    render(<TrainingEffect aer={3.4} ana={2.1} />)

    expect(screen.getByText('Improving').className).toContain('font-semibold')
  })

  it('renders nothing when the device reported neither', () => {
    const { container } = render(<TrainingEffect aer={null} ana={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when both axes read zero', () => {
    const { container } = render(<TrainingEffect aer={0} ana={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})
