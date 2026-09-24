import 'server-only'
import path from 'path'

/**
 * Read on every call, not at import: the CLIs choose their workspace at run
 * time, and a root frozen at import pointed them at ./data whenever a static
 * import reached this module before they had set it.
 */
export function dataPath(...segments: string[]): string {
  const configured = process.env.RUNOMICS_DATA_DIR
  const root = configured ? path.resolve(configured) : path.join(process.cwd(), 'data')
  return path.join(root, ...segments)
}
