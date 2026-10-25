import { describe, expect, it } from 'vitest'
import { paceAxis } from '../chartAxis'
import { t } from '@/i18n'

describe('paceAxis', () => {
  it('runs every pace axis faster-up, and says so', () => {
    expect(paceAxis()).toEqual({ reversed: true, caption: t.paceAxis.caption })
  })
})
