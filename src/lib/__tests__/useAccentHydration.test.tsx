import { afterEach, describe, expect, it } from 'vitest'
import { ACCENT_STORAGE_KEY } from '../accent'
import { useAccent } from '../useAccent'
import { hydrateOver } from './hydrateAcrossMidnight'

function Accent() {
  const accent = useAccent()
  return <span>{accent}</span>
}

describe('useAccent', () => {
  afterEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  // The server has no localStorage, so its HTML carries the default accent.
  it('hydrates on the default, then takes the accent this browser stored', async () => {
    const { html, container, recoverableErrors } = await hydrateOver(<Accent />, () =>
      localStorage.setItem(ACCENT_STORAGE_KEY, 'cyan')
    )

    expect(html).toContain('teal')
    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toBe('cyan')
  })
})
