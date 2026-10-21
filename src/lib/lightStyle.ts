'use client'

import { useSyncExternalStore } from 'react'
import { LIGHT_STYLE_ATTR, LIGHT_STYLE_STORAGE_KEY } from './lightStyleKeys'

/**
 * Light mode's background (Liquid Glass v3, G14): the Aura - a blurred
 * colour field behind the top of each page, frosted cards over it - or
 * Plain, opaque white cards and no glow. Stored like the accent; the
 * attribute is only written for the non-default, and layout.tsx's
 * accent-init script sets it before first paint, so the aura never flashes.
 */
export type LightStyle = 'aura' | 'plain'

export { LIGHT_STYLE_ATTR, LIGHT_STYLE_STORAGE_KEY }
export const DEFAULT_LIGHT_STYLE: LightStyle = 'aura'

const CHANGE_EVENT = 'runomics:light-style-change'

export function parseLightStyle(stored: string | null): LightStyle {
  return stored === 'plain' ? 'plain' : DEFAULT_LIGHT_STYLE
}

export function readLightStyle(): LightStyle {
  if (typeof window === 'undefined') return DEFAULT_LIGHT_STYLE
  try {
    return parseLightStyle(localStorage.getItem(LIGHT_STYLE_STORAGE_KEY))
  } catch {
    return DEFAULT_LIGHT_STYLE
  }
}

/** The attribute on <html>: only for Plain, as data-accent is only for a non-default accent. */
export function applyLightStyle(style: LightStyle) {
  const root = document.documentElement
  if (style === 'plain') root.setAttribute(LIGHT_STYLE_ATTR, 'plain')
  else root.removeAttribute(LIGHT_STYLE_ATTR)
}

/** Saves the choice and applies it at once: no reload, the aura cross-fades. */
export function setLightStyle(style: LightStyle) {
  try {
    if (style === DEFAULT_LIGHT_STYLE) localStorage.removeItem(LIGHT_STYLE_STORAGE_KEY)
    else localStorage.setItem(LIGHT_STYLE_STORAGE_KEY, style)
  } catch {}
  applyLightStyle(style)
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

/** The saved choice, the default on the server and before hydration. */
export function useLightStyle(): LightStyle {
  return useSyncExternalStore(subscribe, readLightStyle, () => DEFAULT_LIGHT_STYLE)
}

const REDUCED_TRANSPARENCY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)'

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_TRANSPARENCY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

/** iOS's Reduce Transparency or Increase Contrast: the page renders Plain whatever the setting. */
export function useReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_TRANSPARENCY).matches,
    () => false,
  )
}
