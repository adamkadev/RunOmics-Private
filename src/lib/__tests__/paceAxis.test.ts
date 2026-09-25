import { describe, expect, it } from 'vitest'
import { paceAxis } from '../chartAxis'
import { t } from '@/i18n'

describe('paceAxis', () => {
  it('runs every pace axis faster-up, and says so', () => {
    expect(paceAxis()).toEqual({ reversed: true, caption: t.paceAxis.caption })
  })

  it('leaves no footnote saying lower is faster', () => {
    expect(t.analytics.charts.paceTrend.footnote).not.toMatch(/lower is faster/i)
    expect(t.analytics.charts.paceTrend.footnote).toContain(t.paceAxis.caption)
  })
})
