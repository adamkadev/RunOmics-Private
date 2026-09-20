import 'server-only'
import fs from 'fs'

/**
 * Read one of the sync's JSON files, degrading to `fallback` when it is absent
 * or unreadable.
 *
 * Every repository under `repositories/` reads the same kind of file - written
 * by the Python sync, shipped into the build, never edited by hand - and they
 * had grown three different opinions about what a bad read means. Sixteen of
 * nineteen checked `existsSync` first, ten wrapped `JSON.parse` in a
 * `try`/`catch`, and the overlap was not the same set: a truncated
 * `goals.json` threw out of a server component and took the whole page down,
 * while a truncated `shoes.json` quietly became `[]`. Same cause, opposite
 * outcomes, decided by nothing more than which file the request happened to
 * touch.
 *
 * One read, one answer: a page renders without the section it cannot fill. A
 * missing file is the normal state of a fresh checkout, so it is silent; a
 * file that exists but does not parse is a real problem with the dataset and
 * says so on the server console, because the `catch {}` blocks this replaces
 * made corruption look exactly like absence.
 *
 * `existsSync` is gone with them - not only for the syscall, but because the
 * gap between the check and the read is a window in which the sync can replace
 * the file underneath us.
 *
 * Repositories that must fail loudly instead keep doing so: the coaching plan,
 * the Garmin sync state and the VO2max norms are all cases where continuing
 * with a fallback would silently discard real data or publish a wrong number.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[data] could not read ${filePath}:`, error)
    }
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[data] ${filePath} is not valid JSON - falling back:`, error)
    return fallback
  }
}
