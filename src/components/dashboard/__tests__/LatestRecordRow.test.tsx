import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { LatestRecordRow } from '../LatestRecordRow'

const RECORD = { key: 'marathon', label: 'Marathon', seconds: 10_975, paceSecPerKm: 260, activityId: 'a1', date: '2026-09-14', official: true }

describe('LatestRecordRow', () => {
  it('shows the latest record and opens Records', () => {
    render(<LatestRecordRow record={RECORD} />)

    expect(screen.getByText(t.dashboard.latestRecord)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/records')
    expect(screen.getByRole('link')).toHaveTextContent('Marathon 3:02:55')
  })

  it('draws nothing without a dated record', () => {
    const { container } = render(<LatestRecordRow record={{ ...RECORD, date: null }} />)

    expect(container).toBeEmptyDOMElement()
  })
})
