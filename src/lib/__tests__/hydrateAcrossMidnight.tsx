import type { ReactElement } from 'react'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'

/**
 * Prerender `ui` with the clock at `serverTime`, then hydrate the same tree
 * with it at `clientTime` - an ISR page built on one day and opened on the
 * next. Returns the hydrated container and every error React recovered from,
 * a hydration mismatch among them. Needs fake timers.
 */
export async function hydrateAcrossMidnight(
  ui: ReactElement,
  { serverTime, clientTime }: { serverTime: Date; clientTime: Date }
): Promise<{ container: HTMLElement; html: string; recoverableErrors: unknown[] }> {
  vi.setSystemTime(serverTime)
  const html = renderToString(ui)

  vi.setSystemTime(clientTime)
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const recoverableErrors: unknown[] = []
  await act(async () => {
    hydrateRoot(container, ui, { onRecoverableError: (error) => recoverableErrors.push(error) })
  })
  return { container, html, recoverableErrors }
}
