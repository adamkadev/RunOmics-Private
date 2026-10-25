import { copyFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

const require = createRequire(import.meta.url)
const dist = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'))
const { version } = require('maplibre-gl/package.json')
const root = path.join(process.cwd(), 'public', 'maplibre')
const dest = path.join(root, version)

await rm(root, { recursive: true, force: true })
await mkdir(dest, { recursive: true })
await Promise.all(FILES.map((file) => copyFile(path.join(dist, file), path.join(dest, file))))

console.log(`Copied ${FILES.join(', ')} to public/maplibre/${version}/`)
