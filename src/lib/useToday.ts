'use client'

import { useSyncExternalStore } from 'react'
import { appTodayIso } from './calendarDate'

// How often a mounted page re-reads the date. A minute is soon enough to roll
// over at midnight, and an unchanged string re-renders nothing.
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
 * Today as an ISO date, safe to render. The server render and the hydration
 * both use `serverToday` - the date the page was prerendered on - so HTML an
 * ISR cache kept from another day still hydrates as the same tree. After
 * mount it is the reader's date (in NEXT_PUBLIC_TIME_ZONE when set), and it
 * rolls over at midnight while the page stays open.
 */
export function useToday(serverToday: string): string {
  return useSyncExternalStore(subscribe, appTodayIso, () => serverToday)
}
