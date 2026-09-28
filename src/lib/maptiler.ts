import { t } from '@/i18n'

const STYLE_LIGHT = 'dataviz-v4'
const STYLE_DARK = 'backdrop-v4-dark'
/**
 * Grey on light too (v4.17): no green parks or blue water under data that is
 * drawn in one colour - the heatmap's tracks. The dark backdrop is grey already.
 */
const STYLE_LIGHT_GREY = 'backdrop-v4-light'

const MAP_LANGUAGE = t.locale.split('-')[0]

export function maptilerStyleUrl(isDark: boolean, token: string, { grey = false }: { grey?: boolean } = {}): string {
  const style = isDark ? STYLE_DARK : grey ? STYLE_LIGHT_GREY : STYLE_LIGHT
  return `https://api.maptiler.com/maps/${style}/style.json?key=${token}&language=${MAP_LANGUAGE}`
}
