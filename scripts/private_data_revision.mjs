#!/usr/bin/env node
/**
 * The optimistic-concurrency marker shared by fetch_private_data.mjs and
 * push_private_data.mjs.
 *
 * fetch records the exact commit it hydrated a workspace from; push refuses to
 * replace the private repository unless the remote is still on that commit.
 * Without it a long-running job overwrites whatever was committed to the data
 * repository while it ran: the nightly Garmin sync takes minutes between its
 * fetch and its push, and pushing is a wholesale `rm -rf data/` + copy, so a
 * commit landing in that window is silently deleted rather than merged.
 *
 * The marker deliberately lives NEXT TO the data directory, never inside it.
 * data/ is the athlete's canonical dataset and is copied verbatim into the
 * private repository, so a base-revision file under data/ would become
 * persisted user data and would be pushed back as part of that dataset.
 * For a workspace at <dir>/data the marker is <dir>/.data.base-revision.json,
 * which means it travels with the workspace across processes - the GitHub
 * Actions job fetches in one step and pushes in another - and is discarded
 * with the workspace's own temporary root.
 *
 * Only the commit SHA is recorded, never the token; the URL is recorded to
 * catch a workspace being pushed at a different repository than it came from,
 * where comparing SHAs would be meaningless.
 */
import fs from 'node:fs'
import path from 'node:path'

export const BASE_REVISION_ENV = 'RUNOMICS_DATA_BASE_REVISION'

export function baseRevisionPath(dataDir) {
  const resolved = path.resolve(dataDir)
  return path.join(path.dirname(resolved), `.${path.basename(resolved)}.base-revision.json`)
}

// Trailing slashes and a trailing .git are cosmetic; the same repository
// reached as ...\/x.git and ...\/x must compare equal.
export function sameRepository(a, b) {
  const normalize = (url) => String(url ?? '').trim().replace(/\/+$/, '').replace(/\.git$/, '')
  return normalize(a) === normalize(b)
}

export function recordBaseRevision(dataDir, { commit, url }) {
  const marker = baseRevisionPath(dataDir)
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(
    marker,
    JSON.stringify({ commit, url: url ?? null, recordedAt: new Date().toISOString() }, null, 2) + '\n'
  )
  return marker
}

/** @param {Record<string, string | undefined>} [env] */
export function readBaseRevision(dataDir, env = process.env) {
  const override = env[BASE_REVISION_ENV]?.trim()
  if (override) return { commit: override, url: null, source: `${BASE_REVISION_ENV}` }

  const marker = baseRevisionPath(dataDir)
  if (!fs.existsSync(marker)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(marker, 'utf-8'))
    if (typeof parsed?.commit !== 'string' || !parsed.commit.trim()) return null
    return { commit: parsed.commit.trim(), url: parsed.url ?? null, source: marker }
  } catch {
    return null
  }
}
