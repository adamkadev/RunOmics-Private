import 'server-only'
import path from 'path'

// Root-level, not public/: everything under public/ is served as a static
// asset. scripts/prepare-data.mjs populates it, next.config.ts traces it.
const DATA_DIR = path.join(process.cwd(), 'data')

export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments)
}
