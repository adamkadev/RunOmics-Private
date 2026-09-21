import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlassTabBar } from '../GlassTabBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('GlassTabBar', () => {
  it('keeps exactly five destinations and does not add a Coach tab', () => {
    render(<GlassTabBar />)

    expect(screen.getByRole('navigation').querySelectorAll('a')).toHaveLength(5)
    expect(screen.queryByRole('link', { name: /coach/i })).not.toBeInTheDocument()
  })
})
