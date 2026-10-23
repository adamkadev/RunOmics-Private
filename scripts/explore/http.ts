import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Overpass answers 406 to every generic agent (curl, node's fetch, even a browser's): clients must name themselves. */
export const USER_AGENT = 'RunOmics explore-areas build script (+https://github.com/adamkadev)'

/** Gitignored with node_modules, and survives `npm ci` only by accident: it is a cache. */
export const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache', 'runomics-explore')

const RETRYABLE = new Set([429, 500, 502, 503, 504])

export class HttpError extends Error {
  constructor(
    readonly label: string,
    readonly status: number,
  ) {
    super(`${label}: HTTP ${status}`)
  }
}

export interface FetchRequest {
  /** Printed in the log instead of the URL, which can carry a bbox. */
  label: string
  url: string
  form?: Record<string, string>
  timeoutMs?: number
  /** Overpass reports a query that ran out of time or memory as a `remark` beside a 200: return a reason to retry. */
  validate?: (text: string) => string | null
}

export interface FetchOptions {
  /** Ignore the cache (the response is still written back). */
  refresh: boolean
  cacheDir?: string
  attempts?: number
  sleep?: (ms: number) => Promise<void>
  log?: (line: string) => void
}

export interface FetchResult {
  text: string
  cached: boolean
  attempts: number
  ms: number
}

/** Two Overpass queries differ only in their body; only the hash names the file, so no bbox is written to disk. */
export function cacheKey(url: string, body: string): string {
  return createHash('sha256').update(`${url}\n${body}`).digest('hex')
}

/** 20 s, 40 s, 80 s, then 90 s: the shape Overpass's capacity page asks for. */
export function backoffMs(attempt: number, retryAfterS?: number): number {
  const base = Math.min(90_000, 20_000 * 2 ** (attempt - 1))
  return retryAfterS && Number.isFinite(retryAfterS) ? Math.min(90_000, Math.max(base, retryAfterS * 1000)) : base
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function cachedFetch(request: FetchRequest, options: FetchOptions): Promise<FetchResult> {
  const body = request.form ? new URLSearchParams(request.form).toString() : ''
  const cacheDir = options.cacheDir ?? CACHE_DIR
  const file = join(cacheDir, `${cacheKey(request.url, body)}.txt`)
  const log = options.log ?? ((line: string) => console.log(line))
  const started = Date.now()

  if (!options.refresh) {
    let text: string | null = null
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      // Not cached yet.
    }
    // A cache written by an older build of this script, or edited by hand, is refetched rather than trusted.
    if (text !== null && !request.validate?.(text)) return { text, cached: true, attempts: 0, ms: Date.now() - started }
  }

  const attempts = options.attempts ?? 5
  const sleep = options.sleep ?? defaultSleep
  let lastError = ''
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryAfterS: number | undefined
    try {
      const response = await fetch(request.url, {
        method: request.form ? 'POST' : 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...(request.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: request.form ? body : undefined,
        signal: AbortSignal.timeout(request.timeoutMs ?? 60_000),
      })
      const text = await response.text()
      if (response.ok) {
        const invalid = request.validate?.(text) ?? null
        if (!invalid) {
          // Written aside and renamed, so an interrupted run never leaves half a response to read as cached.
          mkdirSync(cacheDir, { recursive: true })
          writeFileSync(`${file}.part`, text)
          renameSync(`${file}.part`, file)
          return { text, cached: false, attempts: attempt, ms: Date.now() - started }
        }
        lastError = invalid
      } else if (RETRYABLE.has(response.status)) {
        lastError = `HTTP ${response.status}`
        retryAfterS = Number(response.headers.get('retry-after') ?? NaN)
      } else {
        throw new HttpError(request.label, response.status)
      }
    } catch (error) {
      if (error instanceof HttpError) throw error
      lastError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    }
    if (attempt < attempts) {
      const wait = backoffMs(attempt, retryAfterS)
      log(`[explore]   ${request.label}: ${lastError} after ${seconds(Date.now() - started)}, retrying in ${Math.round(wait / 1000)} s (attempt ${attempt + 1}/${attempts})`)
      await sleep(wait)
    }
  }
  throw new Error(`${request.label}: gave up after ${attempts} attempts (last: ${lastError})`)
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
