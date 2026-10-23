import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { SegmentedTabs, useSegmentedTabs } from '../SegmentedTabs'

const IDS = ['year', 'allTime'] as const

function Harness() {
  const [value, setValue] = useState<(typeof IDS)[number]>('year')
  const tabs = useSegmentedTabs({ ids: IDS, value, onChange: setValue })
  return (
    <>
      <SegmentedTabs tabs={tabs} items={[{ id: 'year', label: 'This year' }, { id: 'allTime', label: 'All' }]} label="Period" />
      <div {...tabs.panelProps}>{value}</div>
    </>
  )
}

function renderTabs() {
  render(<Harness />)
  return {
    year: screen.getByRole('tab', { name: 'This year' }),
    allTime: screen.getByRole('tab', { name: 'All' }),
  }
}

describe('segmented tabs', () => {
  it('keeps only the selected tab in the Tab order', () => {
    const { year, allTime } = renderTabs()

    expect(year).toHaveAttribute('tabindex', '0')
    expect(allTime).toHaveAttribute('tabindex', '-1')
  })

  it('moves with the arrow keys, selecting and focusing as it goes', async () => {
    const user = userEvent.setup()
    const { year, allTime } = renderTabs()

    year.focus()
    await user.keyboard('{ArrowRight}')
    expect(allTime).toHaveAttribute('aria-selected', 'true')
    expect(allTime).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(year).toHaveAttribute('aria-selected', 'true')
    expect(year).toHaveFocus()

    await user.keyboard('{End}')
    expect(allTime).toHaveFocus()
  })

  it('ties the selected tab to the panel it shows', () => {
    const { year } = renderTabs()

    const panel = screen.getByRole('tabpanel')
    expect(year).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', year.id)
  })
})
