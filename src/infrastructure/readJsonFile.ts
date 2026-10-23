import 'server-only'
import { DataNotLoadedError, dataFs } from './dataFs'

const isAbsent = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

/**
 * Absent is empty; unreadable falls back with a console warning, since the caller renders a page either way.
 * Readers that must fail loudly - the coaching plan, the Garmin sync state, the activity index - do not use this.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  let raw: string
  try {
    raw = dataFs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    if (error instanceof DataNotLoadedError) throw error
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

  // `null`, scalars and arrays parse fine but would crash the caller's destructuring.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(`[data] ${filePath} is not a JSON object - falling back`)
    return fallback
  }

  return parsed as T
}
