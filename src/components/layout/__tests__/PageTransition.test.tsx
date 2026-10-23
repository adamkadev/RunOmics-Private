import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageTransition } from '../PageTransition'

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics' }))

// jsdom has no AnimationEvent, so React listens for the prefixed name there:
// send both, as bubbling events.
function end(target: Element) {
  act(() => {
    for (const type of ['animationend', 'webkitAnimationEnd']) target.dispatchEvent(new Event(type, { bubbles: true }))
  })
}

describe('PageTransition', () => {
  it('drops its animation once it ends', () => {
    const { container } = render(
      <PageTransition>
        <h1>Analytics</h1>
      </PageTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-fade-up')
    end(wrapper.querySelector('h1')!)
    expect(wrapper.className).toBe('animate-fade-up')
    end(wrapper)
    expect(wrapper.hasAttribute('class')).toBe(false)
  })
})
