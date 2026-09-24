import { en, type Strings } from './en'
import { fr } from './fr'

export type { Strings }

export type Locale = 'en' | 'fr'

export const activeLocale: Locale = process.env.NEXT_PUBLIC_LOCALE === 'fr' ? 'fr' : 'en'

export const t: Strings = activeLocale === 'fr' ? fr : en
