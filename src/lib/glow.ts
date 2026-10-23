'use client'

import { useSyncExternalStore } from 'react'
import { GLOW_ATTR, GLOW_STORAGE_KEY } from './glowKeys'

/** layout.tsx's accent-init script sets the attribute before first paint, so the glow never flashes. */
export { GLOW_ATTR, GLOW_STORAGE_KEY }

const CHANGE_EVENT = 'runomics:glow-change'

export function parseGlow(stored: string | null): boolean {
  return stored !== 'off'
}

export function readGlow(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return parseGlow(localStorage.getItem(GLOW_STORAGE_KEY))
  } catch {
    return true
  }
}

export function applyGlow(on: boolean) {
  const root = document.documentElement
  if (on) root.removeAttribute(GLOW_ATTR)
  else root.setAttribute(GLOW_ATTR, 'off')
}

export function setGlow(on: boolean) {
  try {
    localStorage.setItem(GLOW_STORAGE_KEY, on ? 'on' : 'off')
  } catch {}
  applyGlow(on)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useGlow(): boolean {
  return useSyncExternalStore(subscribe, readGlow, () => true)
}

const REDUCED_TRANSPARENCY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)'

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_TRANSPARENCY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

/** iOS's Reduce Transparency or Increase Contrast turn the glow off whatever the setting. */
export function useReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_TRANSPARENCY).matches,
    () => false,
  )
}
