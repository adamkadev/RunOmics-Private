type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Layer = { id: string; type: string; source?: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number; filter?: Json; paint?: Record<string, Json>; layout?: Record<string, Json> }
export type StyleJson = { version: number; name?: string; layers: Layer[]; sources: Record<string, Json>; [key: string]: Json | Layer[] | undefined }

/** The only layers that may keep a hue, so the athlete's route stays the one bright colour. */
const NATURE = /park|wood|forest|grass|cemetery|leisure|pitch|golf|garden|meadow|scrub|water|river|stream|canal/

function key(layer: Layer): string {
  return `${layer.id} ${layer['source-layer'] ?? ''}`.toLowerCase()
}

export function withKeyPlaceholder(style: StyleJson): StyleJson {
  return JSON.parse(JSON.stringify(style).replace(/([?&]key=)[A-Za-z0-9_-]+/g, '$1{key}'))
}

/** MapTiler adds an editor id and metadata on every save, which would show as a diff each pull. */
export function withoutEditorFields(style: StyleJson, name: string): StyleJson {
  const rest: StyleJson = { ...style, name }
  delete rest.id
  delete rest.metadata
  return rest
}

const HUED = /^(?:hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%|#([0-9a-f]{6}))/i

export function huedColors(style: StyleJson): string[] {
  const found: string[] = []
  const visit = (value: Json, where: string) => {
    if (typeof value === 'string') {
      const m = HUED.exec(value)
      if (!m) return
      const saturated = m[1] !== undefined ? Number(m[1]) > 0 : (() => {
        const n = parseInt(m[2]!, 16)
        const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]
        // 10, not 8: the theme's greys lean green by a few steps (#4f5856).
        return Math.max(r, g, b) - Math.min(r, g, b) > 10
      })()
      if (saturated) found.push(`${where}: ${value}`)
    } else if (Array.isArray(value)) value.forEach((v) => visit(v, where))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => visit(v, `${where}.${k}`))
  }
  for (const layer of style.layers) {
    if (layer.layout?.visibility === 'none' || NATURE.test(key(layer))) continue
    visit((layer.paint ?? {}) as Json, layer.id)
  }
  return found
}
