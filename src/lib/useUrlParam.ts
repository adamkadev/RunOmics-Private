'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * What `removeUrlParams` tells the readers by: the address changed in place,
 * and nothing went Back. A popstate would say Back - the app shell
 * (NavigationHistory, AppShell) takes every one for Back, and then reads the
 * next page opened as a page come back to.
 */
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
 * One search param, read from the address bar and written back with
 * history.replaceState - which the Next router picks up - so a statically
 * rendered page can keep a tab in its URL without a Suspense boundary around
 * useSearchParams. The server snapshot is null: the first paint is the
 * default, and the URL's value takes over after hydration.
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
      window.dispatchEvent(new PopStateEvent('popstate'))
    },
    [name],
  )

  return [value, set]
}

/**
 * Takes params out of the address - one history entry replaced - and tells
 * every `useUrlParam` reader, as its setter does, but with no popstate: the
 * app shell hears nothing, so the page opened next is a push, at its top.
 * (The setter's own popstate, which List | Map and the tabs still send, is
 * heard as Back.) Nothing happens when none of them is there.
 */
export function removeUrlParams(names: readonly string[]): void {
  const url = new URL(window.location.href)
  const present = names.filter((name) => url.searchParams.has(name))
  if (present.length === 0) return
  for (const name of present) url.searchParams.delete(name)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  window.dispatchEvent(new Event(URL_PARAMS_EVENT))
}
