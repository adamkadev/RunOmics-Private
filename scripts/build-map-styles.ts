/**
 * Pulls the styles edited in MapTiler Cloud into the repo, so a style change is reviewed and the app never waits on
 * the style API. Every URL carries `{key}`, which lib/maptiler fills in at run time.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { huedColors, withKeyPlaceholder, withoutEditorFields, type StyleJson } from '@/map/styleChecks'

const MAPS = { light: '01a1fa0c-fe78-741c-91bb-21cb805e3c64', dark: '01a1fa0d-3e31-7989-a394-f50a69919fc1' } as const
const OUT_DIR = join(process.cwd(), 'src', 'map', 'styles')

async function main() {
  const key = process.env.MAPTILER_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!key) throw new Error('[map:styles] set MAPTILER_KEY (or NEXT_PUBLIC_MAPTILER_TOKEN)')

  mkdirSync(OUT_DIR, { recursive: true })
  for (const mode of ['light', 'dark'] as const) {
    const res = await fetch(`https://api.maptiler.com/maps/${MAPS[mode]}/style.json?key=${key}`)
    if (!res.ok) throw new Error(`[map:styles] ${mode}: HTTP ${res.status}`)
    const style = withKeyPlaceholder(withoutEditorFields((await res.json()) as StyleJson, `runomics-${mode}`))
    if (JSON.stringify(style).includes(key)) throw new Error(`[map:styles] ${mode}: the key is still in the style`)

    const hued = huedColors(style)
    if (hued.length) console.warn(`[map:styles] ${mode}: colours with a hue outside parks and water:\n  ${hued.join('\n  ')}`)

    const file = join(OUT_DIR, `runomics-${mode}.json`)
    writeFileSync(file, `${JSON.stringify(style, null, 2)}\n`)
    console.log(`[map:styles] ${MAPS[mode]} -> ${file} (${style.layers.length} layers)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
