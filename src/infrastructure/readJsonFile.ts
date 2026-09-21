import 'server-only'
import fs from 'fs'

const isAbsent = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

/**
 * Absent is empty; present-but-unreadable degrades to `fallback` and says which
 * file on the console, because the caller renders a page either way.
 *
 * Readers that must fail loudly instead - the coaching plan, the Garmin sync
 * state, the activity index - deliberately do not use this.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    if (!isAbsent(error)) console.warn(`[data] could not read ${filePath}:`, error)
    return fallback
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.warn(`[data] ${filePath} is not valid JSON - falling back:`, error)
    return fallback
  }

  // `null`, scalars and arrays all parse fine and would destructure into a
  // crash or a silent undefined at the call site; no caller expects one.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(`[data] ${filePath} is not a JSON object - falling back`)
    return fallback
  }

  return parsed as T
}
