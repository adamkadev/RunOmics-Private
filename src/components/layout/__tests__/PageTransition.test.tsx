import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageTransition } from '../PageTransition'

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics' }))

// jsdom has no AnimationEvent, so React listens for the prefixed name there;
// a browser gets the standard one. Send both, as bubbling events.
function end(target: Element) {
  act(() => {
    for (const type of ['animationend', 'webkitAnimationEnd']) target.dispatchEvent(new Event(type, { bubbles: true }))
  })
}

describe('PageTransition', () => {
  // v4.6 2b: nothing above a page's large title stays animated once the
  // entry animation has run.
  it('drops its animation once it ends', () => {
    const { container } = render(
      <PageTransition>
        <h1>Analytics</h1>
      </PageTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-fade-up')
    // A child's own animation ending leaves the wrapper's alone.
    end(wrapper.querySelector('h1')!)
    expect(wrapper.className).toBe('animate-fade-up')
    end(wrapper)
    expect(wrapper.hasAttribute('class')).toBe(false)
  })
})
