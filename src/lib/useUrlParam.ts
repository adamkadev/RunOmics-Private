'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Not a popstate: the app shell (NavigationHistory, AppShell) takes every popstate for Back. */
export const URL_PARAMS_EVENT = 'runomics:url-params'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(URL_PARAMS_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(URL_PARAMS_EVENT, onChange)
  }
}

/**
 * history.replaceState, which the Next router picks up, lets a statically
 * rendered page keep a tab in its URL without a Suspense boundary around useSearchParams.
 */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  )

  const set = useCallback(
    (next: string | null) => {
      const url = new URL(window.location.href)
      if (next === null) url.searchParams.delete(name)
      else url.searchParams.set(name, next)
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      window.dispatchEvent(new Event(URL_PARAMS_EVENT))
    },
    [name],
  )

  return [value, set]
}

/** No popstate, as with the setter: the app shell hears nothing, so the page opened next is a push, at its top. */
export function removeUrlParams(names: readonly string[]): void {
  const url = new URL(window.location.href)
  const present = names.filter((name) => url.searchParams.has(name))
  if (present.length === 0) return
  for (const name of present) url.searchParams.delete(name)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  window.dispatchEvent(new Event(URL_PARAMS_EVENT))
}
