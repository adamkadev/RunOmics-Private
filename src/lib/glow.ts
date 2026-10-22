'use client'

import { useSyncExternalStore } from 'react'
import { GLOW_ATTR, GLOW_STORAGE_KEY } from './glowKeys'

/**
 * The background glow (Liquid Glass v3, G14; round 2, F2): the aura - a
 * blurred colour field behind the top of each page - in both themes, and
 * 88 % white cards over it in light. One switch, on by default, stored like the
 * accent: the attribute is written only when it is off, and layout.tsx's
 * accent-init script sets it before first paint, so the glow never flashes.
 */
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

/** The attribute on <html>: only when off, as data-accent is only for a non-default accent. */
export function applyGlow(on: boolean) {
  const root = document.documentElement
  if (on) root.removeAttribute(GLOW_ATTR)
  else root.setAttribute(GLOW_ATTR, 'off')
}

/** Saves the choice and applies it at once, no reload. */
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

/** The saved choice; on, on the server and before hydration. */
export function useGlow(): boolean {
  return useSyncExternalStore(subscribe, readGlow, () => true)
}

const REDUCED_TRANSPARENCY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)'

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_TRANSPARENCY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

/** iOS's Reduce Transparency or Increase Contrast: the glow is off whatever the setting. */
export function useReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_TRANSPARENCY).matches,
    () => false,
  )
}
