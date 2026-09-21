import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

const require = createRequire(import.meta.url)
const dist = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'))
const dest = path.join(process.cwd(), 'public', 'maplibre')

await mkdir(dest, { recursive: true })
await Promise.all(FILES.map((file) => copyFile(path.join(dist, file), path.join(dest, file))))

console.log(`Copied ${FILES.join(', ')} to public/maplibre/`)
