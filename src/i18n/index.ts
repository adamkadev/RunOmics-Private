import { en } from './en'
import { fr } from './fr'

export type Strings = typeof en

export type Locale = 'en' | 'fr'

export const activeLocale: Locale = process.env.NEXT_PUBLIC_LOCALE === 'fr' ? 'fr' : 'en'

export const t: Strings = activeLocale === 'fr' ? fr : en
