// Usage: node scripts/generate-brand.mjs   (then npm run splash)
import sharp from 'sharp'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadLibModules, ROOT } from './loadPalette.mjs'

const { MARK_PATHS, MARK_SMALL_PATHS, MARK_STROKE, MARK_SMALL_STROKE } = await loadLibModules('brandMark', ['brandMark'])
const { SURFACES } = await loadLibModules('themeTokens', ['palette', 'accentScale', 'themeTokens'])
const { CURATED_ACCENTS, DEFAULT_ACCENT } = await loadLibModules('accent', ['accentScale', 'accent'])

const teal = CURATED_ACCENTS.find((a) => a.id === DEFAULT_ACCENT)
const ACCENT = teal.dark.acc
const INK = teal.dark.onAcc
const BG = SURFACES.dark.background

const out = join(ROOT, 'public/icons')
mkdirSync(out, { recursive: true })

const group = (color, paths = MARK_PATHS, width = MARK_STROKE) =>
  `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`
const mark = (color, paths, width) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">${group(color, paths, width)}</svg>\n`
// The square is left unrounded: iOS masks it.
const icon = (bg, fg, size = 1024, ratio = 0.74) => {
  const m = size * ratio
  const o = (size - m) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<g transform="translate(${o} ${o}) scale(${m / 44})">${group(fg)}</g></svg>\n`
}
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" rx="10" fill="${ACCENT}"/><g transform="translate(5.7 5.7) scale(.74)">${group(INK, MARK_SMALL_PATHS, MARK_SMALL_STROKE)}</g></svg>\n`

const svgs = {
  'mark.svg': mark('currentColor'),
  'mark-small.svg': mark('currentColor', MARK_SMALL_PATHS, MARK_SMALL_STROKE),
  'app-icon.svg': icon(ACCENT, INK),
  'favicon.svg': favicon,
  'splash-mark.svg': icon(null, ACCENT, 288, 1),
}
for (const [file, svg] of Object.entries(svgs)) writeFileSync(join(out, file), svg)

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(join(out, file))
await Promise.all([
  png(svgs['app-icon.svg'], 180, 'apple-touch-icon.png'),
  png(svgs['app-icon.svg'], 192, 'maskable-192.png'),
  png(svgs['app-icon.svg'], 512, 'maskable-512.png'),
  png(svgs['app-icon.svg'], 192, 'web-192.png'),
  png(svgs['app-icon.svg'], 512, 'web-512.png'),
  png(favicon, 32, 'web-32.png'),
  png(favicon, 16, 'web-16.png'),
])

const manifestPath = join(ROOT, 'src/app/manifest.json/manifest.base.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.background_color = BG
manifest.theme_color = BG
manifest.icons = [
  { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  { src: '/icons/web-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/web-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

console.log('Brand assets written to public/icons', { accent: `CURATED_ACCENTS.${DEFAULT_ACCENT}.dark.acc ${ACCENT}`, ink: INK, bg: BG })
