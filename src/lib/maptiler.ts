import { t } from '@/i18n'

const STYLE_LIGHT = 'dataviz-v4'
const STYLE_DARK = 'backdrop-v4-dark'

const MAP_LANGUAGE = t.locale.split('-')[0]

export function maptilerStyleUrl(isDark: boolean, token: string): string {
  const style = isDark ? STYLE_DARK : STYLE_LIGHT
  return `https://api.maptiler.com/maps/${style}/style.json?key=${token}&language=${MAP_LANGUAGE}`
}
