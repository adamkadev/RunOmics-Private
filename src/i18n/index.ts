import { en } from './en'
import { fr } from './fr'

// Shape every locale must satisfy. Derived from English, the reference locale.
export type Strings = typeof en

// Active locale, chosen at build time via NEXT_PUBLIC_LOCALE ('en' | 'fr').
// `t` is imported statically across server and client components, so the
// choice is per-deployment rather than per-request. Defaults to English.
export const t: Strings = process.env.NEXT_PUBLIC_LOCALE === 'fr' ? fr : en
