/**
 * Run by hand after a MapTiler style update; the styles are committed. The key never reaches the files: every
 * URL carries `{key}`, which lib/maptiler fills in at run time.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMapStyle, huedColors, type StyleJson } from '@/map/buildMapStyle'
import { MAP_STYLE_COLORS } from '@/lib/themeTokens'

const SOURCES = { light: 'dataviz-v4', dark: 'dataviz-v4-dark' } as const
const OUT_DIR = join(process.cwd(), 'src', 'map', 'styles')

async function main() {
  const restyle = process.argv.includes('--restyle')
  const key = process.env.MAPTILER_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!key && !restyle) throw new Error('[map:styles] set MAPTILER_KEY (or NEXT_PUBLIC_MAPTILER_TOKEN), or pass --restyle')

  mkdirSync(OUT_DIR, { recursive: true })
  let failed = false
  for (const mode of ['light', 'dark'] as const) {
    const file = join(OUT_DIR, `runomics-${mode}.json`)
    const source = restyle ? (JSON.parse(readFileSync(file, 'utf8')) as StyleJson) : await fetchStyle(SOURCES[mode], key!)
    const style = buildMapStyle(source, `RunOmics ${mode === 'dark' ? 'Dark' : 'Light'}`, MAP_STYLE_COLORS[mode])

    const hued = huedColors(style)
    if (hued.length) {
      failed = true
      console.error(`[map:styles] ${mode}: colours with a hue left in visible layers:\n  ${hued.join('\n  ')}`)
    }
    if (key && JSON.stringify(style).includes(key)) throw new Error(`[map:styles] ${mode}: the key is still in the style`)

    writeFileSync(file, `${JSON.stringify(style, null, 2)}\n`)
    console.log(`[map:styles] ${restyle ? 'restyled' : SOURCES[mode]} -> ${file} (${style.layers.length} layers)`)
  }
  if (failed) process.exit(1)
}

async function fetchStyle(id: string, key: string): Promise<StyleJson> {
  const res = await fetch(`https://api.maptiler.com/maps/${id}/style.json?key=${key}`)
  if (!res.ok) throw new Error(`[map:styles] ${id}: HTTP ${res.status}`)
  return (await res.json()) as StyleJson
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
