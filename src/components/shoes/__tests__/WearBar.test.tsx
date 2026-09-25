import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { WearBar } from '../WearBar'

describe('WearBar', () => {
  // 1,375 of 500 km stopped at full and read "100%".
  it('scales to max(km, limit), ticks the limit and hatches the overrun', () => {
    render(<WearBar totalKm={1_375} maxKm={500} fillClass="bg-red-500" />)

    const limitShare = (500 / 1_375) * 100
    expect(screen.getByTestId('wear-limit').style.left).toBe(`${limitShare}%`)
    expect(screen.getByTestId('wear-overrun')).toBeInTheDocument()
    expect(screen.getByText(t.shoes.wearBarCaption)).toBeInTheDocument()
  })

  it('draws a plain fill inside the limit', () => {
    render(<WearBar totalKm={380} maxKm={500} fillClass="bg-green-500" />)

    expect(screen.queryByTestId('wear-overrun')).not.toBeInTheDocument()
    expect(screen.queryByText(t.shoes.wearBarCaption)).not.toBeInTheDocument()
  })
})
