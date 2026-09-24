import type { ReactElement } from 'react'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'

interface Hydrated {
  container: HTMLElement
  html: string
  /** Every error React recovered from - a hydration mismatch among them. */
  recoverableErrors: unknown[]
}

/**
 * Prerender `ui`, let `beforeHydrate` change what the browser holds (its
 * clock, its storage), then hydrate the same tree over the server's HTML.
 */
export async function hydrateOver(ui: ReactElement, beforeHydrate: () => void = () => {}): Promise<Hydrated> {
  const html = renderToString(ui)
  beforeHydrate()

  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const recoverableErrors: unknown[] = []
  await act(async () => {
    hydrateRoot(container, ui, { onRecoverableError: (error) => recoverableErrors.push(error) })
  })
  return { container, html, recoverableErrors }
}

/**
 * Prerender `ui` with the clock at `serverTime`, then hydrate it with the
 * clock at `clientTime` - an ISR page built on one day and opened on the next.
 * Needs fake timers.
 */
export async function hydrateAcrossMidnight(
  ui: ReactElement,
  { serverTime, clientTime }: { serverTime: Date; clientTime: Date }
): Promise<Hydrated> {
  vi.setSystemTime(serverTime)
  return hydrateOver(ui, () => vi.setSystemTime(clientTime))
}
