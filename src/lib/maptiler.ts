const STYLE_LIGHT = 'dataviz-v4'
const STYLE_DARK = 'backdrop-v4-dark'

export function maptilerStyleUrl(isDark: boolean, token: string): string {
  const style = isDark ? STYLE_DARK : STYLE_LIGHT
  return `https://api.maptiler.com/maps/${style}/style.json?key=${token}`
}
