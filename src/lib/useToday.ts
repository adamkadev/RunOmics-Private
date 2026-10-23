'use client'

import { useSyncExternalStore } from 'react'
import { appTodayIso } from './calendarDate'

// Soon enough to roll over at midnight; an unchanged string re-renders nothing.
const RECHECK_MS = 60_000

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, RECHECK_MS)
  // A tab asleep across midnight wakes with its timer late; re-read on return.
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onChange)
  }
}

/**
 * The server render and the hydration both use `serverToday`, the prerender's
 * date, so HTML an ISR cache kept from another day still hydrates as the same tree.
 */
export function useToday(serverToday: string): string {
  return useSyncExternalStore(subscribe, appTodayIso, () => serverToday)
}
