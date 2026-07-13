import { t } from '@/i18n'

const STYLE_LIGHT = 'dataviz-v4'
const STYLE_DARK = 'backdrop-v4-dark'

// MapTiler expects an ISO 639-1 code (e.g. 'en', 'fr'), while t.locale is a
// BCP 47 tag (e.g. 'en-US', 'fr-FR'). Keeps map labels in sync with the
// dropdown, which is localized the same way in reverseGeocode.ts.
const MAP_LANGUAGE = t.locale.split('-')[0]

export function maptilerStyleUrl(isDark: boolean, token: string): string {
  const style = isDark ? STYLE_DARK : STYLE_LIGHT
  return `https://api.maptiler.com/maps/${style}/style.json?key=${token}&language=${MAP_LANGUAGE}`
}
