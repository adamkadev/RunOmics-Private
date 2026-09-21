#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

export const BASE_REVISION_ENV = 'RUNOMICS_DATA_BASE_REVISION'

export function baseRevisionPath(dataDir) {
  const resolved = path.resolve(dataDir)
  return path.join(path.dirname(resolved), `.${path.basename(resolved)}.base-revision.json`)
}

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
