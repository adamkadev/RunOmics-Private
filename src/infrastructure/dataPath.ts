import 'server-only'
import path from 'path'

const DATA_DIR = process.env.RUNOMICS_DATA_DIR
  ? path.resolve(process.env.RUNOMICS_DATA_DIR)
  : path.join(process.cwd(), 'data')

export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments)
}
